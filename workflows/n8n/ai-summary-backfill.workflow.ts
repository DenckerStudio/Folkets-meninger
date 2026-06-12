import {
  workflow,
  node,
  trigger,
  sticky,
  newCredential,
  languageModel,
  outputParser,
  splitInBatches,
  nextBatch,
  expr,
  placeholder,
} from '@n8n/workflow-sdk';

const MISSING_SUMMARIES_SQL = `SELECT i.id, i.title, i.summary, i.detail_json
FROM public.stortinget_issues i
LEFT JOIN public.issue_ai_summaries s ON s.stortinget_issue_id = i.id
WHERE s.stortinget_issue_id IS NULL
ORDER BY i.last_synced_at DESC NULLS LAST
LIMIT $1`;

const FETCH_ISSUE_BY_ID_SQL = `SELECT id, title, summary, detail_json
FROM public.stortinget_issues
WHERE id = $1`;

const BUILD_CONTEXT_JS = `const item = $input.item.json;
const detail =
  item.detail_json && typeof item.detail_json === 'object'
    ? item.detail_json
    : item.detail_json
      ? JSON.parse(String(item.detail_json))
      : {};
const parts = [
  'Sak ID: ' + item.id,
  item.title ? 'Tittel: ' + item.title : null,
  item.summary ? 'Kort beskrivelse: ' + item.summary : null,
  detail.innstillingstekst ? 'Innstillingstekst:\\n' + detail.innstillingstekst : null,
  detail.kortvedtak ? 'Kortvedtak:\\n' + detail.kortvedtak : null,
  detail.vedtakstekst ? 'Vedtakstekst:\\n' + detail.vedtakstekst : null,
  detail.parentestekst ? 'Parentestekst:\\n' + detail.parentestekst : null,
].filter(Boolean);
let sakContextText = parts.join('\\n\\n');
if (sakContextText.length > 12000) {
  sakContextText = sakContextText.slice(0, 12000) + '\\n\\n[... avkortet ...]';
}
return { json: { ...item, sakContextText } };`;

const MAP_V2_BODY_JS = `function normalizeLabel(s) {
  const t = String(s ?? '').trim().replace(/\\s+/g, ' ');
  if (t.length < 2 || t.length > 48) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function parseCards(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 3)
    .map((c) => {
      if (!c || typeof c !== 'object') return null;
      const title = String(c.title ?? '').trim();
      const body = String(c.body ?? '').trim();
      if (!title || !body) return null;
      return { title: title.slice(0, 80), body: body.slice(0, 600) };
    })
    .filter(Boolean);
}
const item = $input.item.json;
let out = item.output ?? item;
if (typeof out === 'string') {
  try {
    out = JSON.parse(out);
  } catch (_) {
    out = {};
  }
}
const narrative = String(out.narrative ?? '').trim();
const who_affected = String(out.who_affected ?? '').trim();
const how_affected = String(out.how_affected ?? '').trim();
const topic_cards = parseCards(out.topic_cards);
const labelKeys = new Set();
const labels = [];
for (const raw of Array.isArray(out.labels) ? out.labels : []) {
  const label = normalizeLabel(raw);
  if (!label) continue;
  const key = label.toLowerCase();
  if (labelKeys.has(key)) continue;
  labelKeys.add(key);
  labels.push(label);
  if (labels.length >= 5) break;
}
for (const card of topic_cards) {
  if (labels.length >= 2) break;
  const label = normalizeLabel(card.title);
  if (!label) continue;
  const key = label.toLowerCase();
  if (labelKeys.has(key)) continue;
  labelKeys.add(key);
  labels.push(label);
}
const econCard = topic_cards.find((c) => /økonom|kost|finans|skatt/i.test(c.title));
const kostnad = econCard
  ? econCard.body
  : topic_cards[0]?.body && /økonom|kost|finans|skatt/i.test(topic_cards[0].title)
    ? topic_cards[0].body
    : 'Ikke omtalt i kilden.';`;

const MAP_AGENT_OUTPUT_JS = `${MAP_V2_BODY_JS}
const issueId = $('Process one issue').item?.json?.id ?? item.id;
return {
  json: {
    issueId,
    narrative,
    who_affected,
    how_affected,
    topic_cards,
    labels,
    hva: narrative,
    hvem: who_affected,
    kostnad,
  },
};`;

const MAP_AGENT_OUTPUT_WEBHOOK_JS = `${MAP_V2_BODY_JS}
const issueId = $('Normalize issue ID').item?.json?.id ?? item.id;
return {
  json: {
    issueId,
    narrative,
    who_affected,
    how_affected,
    topic_cards,
    labels,
    hva: narrative,
    hvem: who_affected,
    kostnad,
  },
};`;

const PREPARE_UPSERT_SQL_JS = `const {
  issueId,
  narrative,
  who_affected,
  how_affected,
  topic_cards,
  labels,
  hva,
  hvem,
  kostnad,
} = $input.item.json;
function esc(value) {
  return "'" + String(value ?? '').replace(/'/g, "''") + "'";
}
function pgTextArray(arr) {
  const list = Array.isArray(arr) ? arr : [];
  if (!list.length) return "ARRAY[]::text[]";
  return "ARRAY[" + list.map((a) => esc(a)).join(", ") + "]::text[]";
}
const cardsJson = esc(JSON.stringify(topic_cards || [])) + "::jsonb";
const labelsSql = pgTextArray(labels);
const upsertSql = \`WITH ups AS (
  INSERT INTO public.issue_ai_summaries (
    stortinget_issue_id,
    narrative,
    who_affected,
    how_affected,
    topic_cards,
    labels,
    hva,
    hvem,
    kostnad,
    updated_at
  ) VALUES (
    \${esc(issueId)},
    \${esc(narrative)},
    \${esc(who_affected)},
    \${esc(how_affected)},
    \${cardsJson},
    \${labelsSql},
    \${esc(hva)},
    \${esc(hvem)},
    \${esc(kostnad)},
    NOW()
  )
  ON CONFLICT (stortinget_issue_id) DO UPDATE SET
    narrative = EXCLUDED.narrative,
    who_affected = EXCLUDED.who_affected,
    how_affected = EXCLUDED.how_affected,
    topic_cards = EXCLUDED.topic_cards,
    labels = EXCLUDED.labels,
    hva = EXCLUDED.hva,
    hvem = EXCLUDED.hvem,
    kostnad = EXCLUDED.kostnad,
    updated_at = NOW()
  RETURNING stortinget_issue_id, labels
)
UPDATE public.stortinget_issues i
SET ai_labels = ups.labels
FROM ups
WHERE i.id = ups.stortinget_issue_id\`;
return {
  json: {
    issueId,
    narrative,
    who_affected,
    how_affected,
    topic_cards,
    labels,
    hva,
    hvem,
    kostnad,
    upsertSql,
  },
};`;

const SUMMARY_SYSTEM_MESSAGE = `Du er en nøytral, faktabasert assistent for «Folkets Stemme» som forenkler stortingssaker for vanlige borgere.

SPRÅK: Skriv utelukkende på norsk (bokmål). Korte, tydelige setninger. Saklig og nøytral. Bygg kun på kilden.

Returner JSON med:
- narrative: Kort overordnet forklaring (2–4 setninger)
- who_affected: Hvem som berøres (2–3 setninger, kun fra kilden)
- how_affected: Hvordan de berøres (2–3 setninger, konkret)
- topic_cards: 0–3 temakort valgt ut fra sakens innhold. Hvert kort: { "title": "...", "body": "..." }
- labels: 2–5 korte nøkkelord på norsk (Title Case, konsistent). Brukes til søk og varsler.

Regler:
- who_affected og how_affected skal alltid fylles ut
- topic_cards er dynamiske (ikke fast hva/hvem/kostnad)
- Ingen oppdiktede beløp; skriv «ukjent» eller «ikke omtalt» når kilden mangler tall
- labels skal være generelle emneord (f.eks. Skatt, Helse, Privatøkonomi), ikke hele setninger`;

const ollamaChatModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Ollama Chat Model',
    credentials: { ollamaApi: newCredential('Ollama Heyklever') },
    parameters: {
      model: placeholder('llama3.2:3b-text-q4_K_M'),
      options: {
        temperature: 0.3,
        format: 'json',
        numPredict: 900,
      },
    },
  },
});

const summaryOutputParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Summary JSON parser',
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample:
        '{"narrative":"Kort overordnet forklaring","who_affected":"Hvem som berøres","how_affected":"Hvordan de berøres","topic_cards":[{"title":"Finansiering","body":"..."}],"labels":["Skatt","Privatøkonomi"]}',
    },
  },
});

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Every 10 minutes',
    parameters: {
      rule: {
        interval: [{ field: 'minutes', minutesInterval: 10 }],
      },
    },
  },
  output: [{}],
});

const backfillSettingsSchedule = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Backfill settings (schedule)',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          {
            id: 'batch-limit',
            name: 'batchLimit',
            value: '1',
            type: 'string',
          },
        ],
      },
    },
  },
  output: [{ batchLimit: '1' }],
});

const fetchMissingSummaries = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch issues without summary',
    credentials: { postgres: newCredential('Supabase Postgres Folkets') },
    parameters: {
      operation: 'executeQuery',
      query: MISSING_SUMMARIES_SQL,
      options: {
        queryReplacement: expr(
          '{{ $("Backfill settings (schedule)").item.json.batchLimit }}'
        ),
      },
    },
  },
  output: [
    {
      id: '200329',
      title: 'Example sak',
      summary: 'Kort tittel',
      detail_json: { innstillingstekst: 'Eksempeltekst' },
    },
  ],
});

const processOneIssue = splitInBatches({
  version: 3,
  config: {
    name: 'Process one issue',
    parameters: { batchSize: 1 },
  },
});

const buildSakContext = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build sak context',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: BUILD_CONTEXT_JS,
    },
  },
  output: [
    {
      id: '200329',
      title: 'Example sak',
      summary: 'Kort',
      sakContextText: 'Sak ID: 200329\nTittel: Example',
    },
  ],
});

const generateSummaryAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Generate summary (Ollama)',
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.sakContextText }}'),
      hasOutputParser: true,
      options: {
        systemMessage: SUMMARY_SYSTEM_MESSAGE,
        maxIterations: 4,
        enableStreaming: false,
      },
      subnodes: {
        model: ollamaChatModel,
        outputParser: summaryOutputParser,
      },
    },
  },
  output: [
    {
      output: {
        narrative: 'Sakens innhold',
        who_affected: 'Berørte grupper',
        how_affected: 'Konkret påvirkning',
        topic_cards: [{ title: 'Finansiering', body: 'Økonomiske konsekvenser' }],
        labels: ['Skatt', 'Privatøkonomi'],
      },
    },
  ],
});

const mapAgentOutput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Map agent output',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: MAP_AGENT_OUTPUT_JS,
    },
  },
  output: [
    {
      issueId: '200329',
      narrative: 'Sakens innhold',
      who_affected: 'Berørte grupper',
      how_affected: 'Konkret påvirkning',
      topic_cards: [{ title: 'Finansiering', body: 'Økonomi' }],
      labels: ['Skatt', 'Privatøkonomi'],
      hva: 'Sakens innhold',
      hvem: 'Berørte grupper',
      kostnad: 'Økonomi',
    },
  ],
});

const prepareUpsertSql = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare upsert SQL',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: PREPARE_UPSERT_SQL_JS,
    },
  },
  output: [
    {
      issueId: '200329',
      narrative: 'Sakens innhold',
      who_affected: 'Berørte grupper',
      how_affected: 'Konkret påvirkning',
      topic_cards: [{ title: 'Finansiering', body: 'Økonomi' }],
      labels: ['Skatt', 'Privatøkonomi'],
      hva: 'Sakens innhold',
      hvem: 'Berørte grupper',
      kostnad: 'Økonomi',
      upsertSql: 'INSERT INTO ...',
    },
  ],
});

const saveSummaryToDb = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save summary to Supabase',
    credentials: { postgres: newCredential('Supabase Postgres Folkets') },
    parameters: {
      operation: 'executeQuery',
      query: expr('{{ $json.upsertSql }}'),
    },
  },
  output: [{ success: true }],
});

const logSummaryResult = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Log summary result',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          {
            id: 'issue-id',
            name: 'issueId',
            value: expr('{{ $("Prepare upsert SQL").item.json.issueId }}'),
            type: 'string',
          },
          {
            id: 'saved',
            name: 'saved',
            value: true,
            type: 'boolean',
          },
        ],
      },
    },
  },
  output: [{ issueId: '200329', saved: true }],
});

const rateLimitPause = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: {
    name: 'Rate limit pause',
    parameters: {
      resume: 'timeInterval',
      amount: 5,
      unit: 'seconds',
    },
  },
});

const batchRunComplete = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Batch run complete',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          {
            id: 'status',
            name: 'status',
            value: 'scheduled_backfill_complete',
            type: 'string',
          },
          {
            id: 'at',
            name: 'completedAt',
            value: expr('{{ $now.toISO() }}'),
            type: 'string',
          },
        ],
      },
    },
  },
  output: [{ status: 'scheduled_backfill_complete' }],
});

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook new issue',
    parameters: {
      httpMethod: 'POST',
      path: 'folkets-ai-summary',
      responseMode: 'responseNode',
    },
  },
  output: [{ body: { stortinget_issue_id: '200329' } }],
});

const normalizeIssueId = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Normalize issue ID',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          {
            id: 'issue-id',
            name: 'id',
            value: expr(
              '{{ $json.body?.stortinget_issue_id ?? $json.body?.id ?? $json.stortinget_issue_id ?? $json.id }}'
            ),
            type: 'string',
          },
        ],
      },
    },
  },
  output: [{ id: '200329' }],
});

const fetchIssueById = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch issue by ID',
    credentials: { postgres: newCredential('Supabase Postgres Folkets') },
    parameters: {
      operation: 'executeQuery',
      query: FETCH_ISSUE_BY_ID_SQL,
      options: {
        queryReplacement: expr('{{ $("Normalize issue ID").item.json.id }}'),
      },
    },
  },
  output: [
    {
      id: '200329',
      title: 'Example sak',
      summary: 'Kort',
      detail_json: {},
    },
  ],
});

const buildSakContextWebhook = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build sak context (webhook)',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: BUILD_CONTEXT_JS,
    },
  },
  output: [{ id: '200329', sakContextText: 'Sak ID: 200329' }],
});

const generateSummaryAgentWebhook = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Generate summary (Ollama webhook)',
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.sakContextText }}'),
      hasOutputParser: true,
      options: {
        systemMessage: SUMMARY_SYSTEM_MESSAGE,
        maxIterations: 4,
        enableStreaming: false,
      },
      subnodes: {
        model: ollamaChatModel,
        outputParser: summaryOutputParser,
      },
    },
  },
  output: [
    {
      output: {
        narrative: 'Sakens innhold',
        who_affected: 'Berørte grupper',
        how_affected: 'Konkret påvirkning',
        topic_cards: [{ title: 'Finansiering', body: 'Økonomiske konsekvenser' }],
        labels: ['Skatt', 'Privatøkonomi'],
      },
    },
  ],
});

const mapAgentOutputWebhook = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Map agent output (webhook)',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: MAP_AGENT_OUTPUT_WEBHOOK_JS,
    },
  },
  output: [
    {
      issueId: '200329',
      narrative: 'Sakens innhold',
      who_affected: 'Berørte grupper',
      how_affected: 'Konkret påvirkning',
      topic_cards: [{ title: 'Finansiering', body: 'Økonomi' }],
      labels: ['Skatt', 'Privatøkonomi'],
      hva: 'Sakens innhold',
      hvem: 'Berørte grupper',
      kostnad: 'Økonomi',
    },
  ],
});

const prepareUpsertSqlWebhook = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare upsert SQL (webhook)',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: PREPARE_UPSERT_SQL_JS,
    },
  },
  output: [
    {
      issueId: '200329',
      narrative: 'Sakens innhold',
      who_affected: 'Berørte grupper',
      how_affected: 'Konkret påvirkning',
      topic_cards: [{ title: 'Finansiering', body: 'Økonomi' }],
      labels: ['Skatt', 'Privatøkonomi'],
      hva: 'Sakens innhold',
      hvem: 'Berørte grupper',
      kostnad: 'Økonomi',
      upsertSql: 'INSERT INTO ...',
    },
  ],
});

const saveSummaryWebhook = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save summary (webhook)',
    credentials: { postgres: newCredential('Supabase Postgres Folkets') },
    parameters: {
      operation: 'executeQuery',
      query: expr('{{ $json.upsertSql }}'),
    },
  },
  output: [{ success: true }],
});

const respondToWebhook = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond to Webhook',
    parameters: {
      respondWith: 'json',
      responseBody: expr(
        '{{ { ok: true, issueId: $("Normalize issue ID").item.json.id, version: 2, narrative: $("Prepare upsert SQL (webhook)").item.json.narrative, who_affected: $("Prepare upsert SQL (webhook)").item.json.who_affected, how_affected: $("Prepare upsert SQL (webhook)").item.json.how_affected, topic_cards: $("Prepare upsert SQL (webhook)").item.json.topic_cards, labels: $("Prepare upsert SQL (webhook)").item.json.labels, saved: true } }}'
      ),
    },
  },
});

sticky(
  '## AI-sammendrag v2 med Ollama\n\n**Ollama credential:** «Ollama Heyklever» → https://ollama.heyklever.app\n\n**Modell:** Rediger i «Ollama Chat Model» (standard llama3.2:3b-text-q4_K_M).\n\n**Postgres:** «Supabase Postgres Folkets». Agent skriver narrative, who/how, topic_cards og labels til `issue_ai_summaries`, og synker `stortinget_issues.ai_labels`.',
  [scheduleTrigger, ollamaChatModel, webhookTrigger],
  { color: 4 }
);

const summaryPipeline = buildSakContext
  .to(generateSummaryAgent)
  .to(mapAgentOutput)
  .to(prepareUpsertSql)
  .to(saveSummaryToDb)
  .to(logSummaryResult);

export default workflow(
  'folkets-ai-summary-backfill',
  'Folkets Stemme – AI-sammendrag backfill'
)
  .add(scheduleTrigger)
  .to(backfillSettingsSchedule)
  .to(fetchMissingSummaries)
  .to(
    processOneIssue
      .onDone(batchRunComplete)
      .onEachBatch(summaryPipeline.to(rateLimitPause.to(nextBatch(processOneIssue))))
  )
  .add(webhookTrigger)
  .to(normalizeIssueId)
  .to(fetchIssueById)
  .to(buildSakContextWebhook)
  .to(generateSummaryAgentWebhook)
  .to(mapAgentOutputWebhook)
  .to(prepareUpsertSqlWebhook)
  .to(saveSummaryWebhook)
  .to(respondToWebhook);
