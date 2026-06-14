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

const MISSING_SUMMARIES_SQL = `SELECT
  i.id,
  i.title,
  i.summary,
  i.detail_json,
  i.ai_summary_source_context,
  COALESCE(
    json_agg(
      json_build_object(
        'document_id', d.document_id,
        'title', d.title,
        'document_type', d.document_type,
        'text_excerpt', d.text_excerpt,
        'source_url', d.source_url
      )
      ORDER BY d.fetched_at DESC
    ) FILTER (WHERE d.document_id IS NOT NULL),
    '[]'::json
  ) AS documents
FROM public.stortinget_issues i
LEFT JOIN public.issue_ai_summaries s ON s.stortinget_issue_id = i.id
LEFT JOIN public.stortinget_issue_documents d ON d.issue_id = i.id
WHERE s.stortinget_issue_id IS NULL
GROUP BY i.id, i.title, i.summary, i.detail_json, i.ai_summary_source_context
ORDER BY i.last_synced_at DESC NULLS LAST
LIMIT $1`;

const FETCH_ISSUE_BY_ID_SQL = `SELECT
  i.id,
  i.title,
  i.summary,
  i.detail_json,
  i.ai_summary_source_context,
  COALESCE(
    json_agg(
      json_build_object(
        'document_id', d.document_id,
        'title', d.title,
        'document_type', d.document_type,
        'text_excerpt', d.text_excerpt,
        'source_url', d.source_url
      )
      ORDER BY d.fetched_at DESC
    ) FILTER (WHERE d.document_id IS NOT NULL),
    '[]'::json
  ) AS documents
FROM public.stortinget_issues i
LEFT JOIN public.stortinget_issue_documents d ON d.issue_id = i.id
WHERE i.id = $1
GROUP BY i.id, i.title, i.summary, i.detail_json, i.ai_summary_source_context`;

const BUILD_CONTEXT_JS = `const item = $input.item.json;
if (item.ai_summary_source_context) {
  let text = String(item.ai_summary_source_context);
  if (text.length > 20000) {
    text = text.slice(0, 20000) + '\\n\\n[... avkortet ...]';
  }
  return { json: { ...item, sakContextText: text } };
}
const detail =
  item.detail_json && typeof item.detail_json === 'object'
    ? item.detail_json
    : item.detail_json
      ? JSON.parse(String(item.detail_json))
      : {};
let documents = item.documents || [];
if (typeof documents === 'string') {
  try { documents = JSON.parse(documents); } catch (_) { documents = []; }
}
const names = (list) => Array.isArray(list)
  ? list.map((p) => [p?.fornavn, p?.etternavn].filter(Boolean).join(' ') + (p?.parti?.navn ? ' (' + p.parti.navn + ')' : '')).filter((x) => x.trim()).join(', ')
  : '';
const listNames = (list) => Array.isArray(list)
  ? list.map((x) => typeof x === 'string' ? x : x?.navn).filter(Boolean).join(', ')
  : '';
const timeline = Array.isArray(detail.saksgang?.saksgang_steg_liste)
  ? detail.saksgang.saksgang_steg_liste.slice(0, 8).flatMap((step) => [
      step.navn ? '- ' + step.navn : null,
      ...(Array.isArray(step.saksgang_hendelse_liste)
        ? step.saksgang_hendelse_liste.map((e) => e?.hendelse_tekst ? '  - ' + e.hendelse_tekst : null)
        : []),
    ]).filter(Boolean).join('\\n')
  : '';
const parts = [
  'Sak ID: ' + item.id,
  item.title ? 'Tittel: ' + item.title : null,
  item.summary ? 'Kort beskrivelse: ' + item.summary : null,
  detail.henvisning ? 'Dokumentreferanse: ' + detail.henvisning : null,
  detail.komite?.navn ? 'Komité: ' + detail.komite.navn : (typeof detail.komite === 'string' ? 'Komité: ' + detail.komite : null),
  listNames(detail.emne_liste) ? 'Emner: ' + listNames(detail.emne_liste) : null,
  listNames(detail.stikkord_liste) ? 'Stikkord: ' + listNames(detail.stikkord_liste) : null,
  names(detail.sak_opphav?.forslagstiller_liste) ? 'Forslagstillere: ' + names(detail.sak_opphav.forslagstiller_liste) : null,
  names(detail.saksordfoerer_liste) ? 'Saksordførere: ' + names(detail.saksordfoerer_liste) : null,
  timeline ? 'Saksgang og hendelser:\\n' + timeline : null,
  detail.innstillingstekst ? 'Innstillingstekst:\\n' + detail.innstillingstekst : null,
  detail.kortvedtak ? 'Kortvedtak:\\n' + detail.kortvedtak : null,
  detail.vedtakstekst ? 'Vedtakstekst:\\n' + detail.vedtakstekst : null,
  detail.parentestekst ? 'Parentestekst:\\n' + detail.parentestekst : null,
  ...documents.slice(0, 5).map((d) => {
    const title = d?.title || d?.document_id || 'Dokument';
    const type = d?.document_type ? ' (' + d.document_type + ')' : '';
    const excerpt = d?.text_excerpt ? String(d.text_excerpt).slice(0, 3000) : '';
    return excerpt ? 'Tilhørende dokument: ' + title + type + '\\n' + excerpt : null;
  }),
].filter(Boolean);
let sakContextText = parts.join('\\n\\n');
if (sakContextText.length > 20000) {
  sakContextText = sakContextText.slice(0, 20000) + '\\n\\n[... avkortet ...]';
}
return { json: { ...item, sakContextText } };`;

const MAP_AGENT_OUTPUT_JS = `const item = $input.item.json;
let out = item.output ?? item;
if (typeof out === 'string') {
  try {
    out = JSON.parse(out);
  } catch (_) {
    out = {};
  }
}
const issueId = $('Process one issue').item?.json?.id ?? item.id;
return {
  json: {
    issueId,
    hva: String(out.hva ?? '').trim(),
    hvem: String(out.hvem ?? '').trim(),
    kostnad: String(out.kostnad ?? '').trim(),
  },
};`;

const MAP_AGENT_OUTPUT_WEBHOOK_JS = `const item = $input.item.json;
let out = item.output ?? item;
if (typeof out === 'string') {
  try {
    out = JSON.parse(out);
  } catch (_) {
    out = {};
  }
}
const issueId = $('Normalize issue ID').item?.json?.id ?? item.id;
return {
  json: {
    issueId,
    hva: String(out.hva ?? '').trim(),
    hvem: String(out.hvem ?? '').trim(),
    kostnad: String(out.kostnad ?? '').trim(),
  },
};`;

const PREPARE_UPSERT_SQL_JS = `const { issueId, hva, hvem, kostnad } = $input.item.json;
function esc(value) {
  return "'" + String(value ?? '').replace(/'/g, "''") + "'";
}
const upsertSql = \`INSERT INTO public.issue_ai_summaries (
  stortinget_issue_id, hva, hvem, kostnad, updated_at
) VALUES (\${esc(issueId)}, \${esc(hva)}, \${esc(hvem)}, \${esc(kostnad)}, NOW())
ON CONFLICT (stortinget_issue_id) DO UPDATE SET
  hva = EXCLUDED.hva,
  hvem = EXCLUDED.hvem,
  kostnad = EXCLUDED.kostnad,
  updated_at = NOW()\`;
return { json: { issueId, hva, hvem, kostnad, upsertSql } };`;

const SUMMARY_SYSTEM_MESSAGE = `Du er en nøytral, faktabasert assistent for «Folkets Stemme» som forenkler stortingssaker for vanlige borgere.

SPRÅK: Skriv utelukkende på norsk (bokmål). Korte, tydelige setninger. Saklig og nøytral. Bygg kun på kilden.

Lag tre korte forklaringer:
- hva: Hva saken handler om (2–3 setninger)
- hvem: Hvem som påvirkes (2–3 setninger, ikke spekuler)
- kostnad: Økonomiske konsekvenser (2–3 setninger, ingen oppdiktede beløp)

Returner strukturert JSON med feltene hva, hvem, kostnad.`;

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
        '{"hva":"Hva saken handler om","hvem":"Hvem som påvirkes","kostnad":"Økonomiske konsekvenser"}',
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
        hva: 'Sakens innhold',
        hvem: 'Berørte grupper',
        kostnad: 'Økonomi',
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
        hva: 'Sakens innhold',
        hvem: 'Berørte grupper',
        kostnad: 'Økonomi',
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
        '{{ { ok: true, issueId: $("Normalize issue ID").item.json.id, hva: $("Prepare upsert SQL (webhook)").item.json.hva, hvem: $("Prepare upsert SQL (webhook)").item.json.hvem, kostnad: $("Prepare upsert SQL (webhook)").item.json.kostnad, saved: true } }}'
      ),
    },
  },
});

sticky(
  '## AI-sammendrag med Ollama\n\n**Ollama credential:** «Ollama Heyklever» → https://ollama.heyklever.app\n\n**Modell:** Rediger i «Ollama Chat Model» (standard llama3.2:3b-text-q4_K_M).\n\n**Postgres:** «Supabase Postgres Folkets». Ingen HTTP til Next.js – agent skriver hva/hvem/kostnad til `issue_ai_summaries`.',
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
