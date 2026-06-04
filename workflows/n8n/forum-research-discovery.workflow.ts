/**
 * Folkets Stemme – Forum research discovery (v7 flow 1)
 * RSS + SearXNG → cluster → AI triage → lagre interessante saker i forum_research_clusters
 *
 * Webhook: folkets-forum-research-discovery
 */
import {
  workflow,
  node,
  trigger,
  sticky,
  newCredential,
  languageModel,
  outputParser,
  ifElse,
  expr,
} from '@n8n/workflow-sdk';
import {
  DISCOVERY_CONTEXT_SQL,
  FETCH_RSS_DISCOVERY_JS,
  COLLECT_HEADLINES_DISCOVERY_JS,
} from './forum-prompt-ingest.shared';

const DISCOVERY_SYSTEM = `Du er nyhetsredaktør for «Folkets Stemme». Du skal finne 3–6 politiske saker som er gode kandidater for dyp research og senere JA/NEI-avstemninger.

INPUT: Klynger med overskrifter (flere medier om samme sak). Du får EXISTING_PROMPTS og RECENT_CLUSTERS – ikke foreslå det samme på nytt.

Oppgave:
1. Velg kun klynger med tydelig politisk konflikt, forslag, vedtak eller valg som folk kan ta stilling til
2. Hver valgt klynge må ha minst 3 artikler og politisk score (ikke sport/kjendis)
3. Forklar kort hvorfor saken er interessant NÅ (ny utvikling, debatt, konsekvens for folk)
4. Prioriter saker med flere kilder og nyere artikler

AVSLÅ klynger som:
- Ren sport, kjendis, kongehus uten politisk beslutning
- Vage «debatt om X» uten konkret politisk handling
- Allerede dekket av EXISTING_PROMPTS eller RECENT_CLUSTERS (nær-duplikat)

Returner KUN gyldig JSON:
{
  "stories": [{
    "cluster_id": 0,
    "title": "Kort sakstittel (maks 100 tegn)",
    "why_interesting": "1–2 setninger om politisk valg/konflikt",
    "priority": 1,
    "topic_tags": ["stikkord"],
    "article_indices": [0,1,2,3],
    "stortinget_issue_id": null
  }]
}

article_indices = globale indekser fra klyngelisten (0, 1, 2, …). Minst 3 per sak.`;

const BUILD_DISCOVERY_INPUT_JS = `const input = $input.first()?.json || {};
const clusters = Array.isArray(input.clusters) ? input.clusters : [];
const headlines = Array.isArray(input.headlines) ? input.headlines : [];
const existingQuestions = Array.isArray(input.existingQuestions) ? input.existingQuestions : [];
const recentClusterTitles = Array.isArray(input.recentClusterTitles) ? input.recentClusterTitles : [];
const discoveryLimit = Math.max(3, Math.min(8, Number(input.discoveryLimit) || 6));

if (!clusters.length) {
  return [{ json: { discoveryText: '', skipDiscovery: true, clusters: [], headlines: [] } }];
}

const ranked = [...clusters].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 14);
const indexByUrl = new Map();
headlines.forEach((h, i) => indexByUrl.set(h.url, i));

const lines = [];
for (const c of ranked) {
  const items = (c.items || []).filter((h) => h.isPolitical !== false || h.longRunning);
  if (items.length < 3) continue;
  lines.push('=== KLYNGE ' + c.id + ' (score=' + (c.score || 0) + ', spanDays=' + (c.spanDays || 0) + ') ===');
  for (const h of items.slice(0, 8)) {
    const idx = indexByUrl.get(h.url);
    if (idx == null) continue;
    const pub = h.publishedAt ? String(h.publishedAt).slice(0, 16) : '';
    lines.push('[' + idx + '] ' + h.title + ' (' + h.outlet + (pub ? ', ' + pub : '') + ')\\n    ' + h.url);
  }
}

const existingBlock = existingQuestions.length
  ? '\\n\\nEXISTING_PROMPTS (ikke foreslå samme tema):\\n' + existingQuestions.slice(0, 35).map((q) => '- ' + q).join('\\n')
  : '';
const recentBlock = recentClusterTitles.length
  ? '\\n\\nRECENT_CLUSTERS (siste 72t – unngå duplikat):\\n' + recentClusterTitles.slice(0, 25).map((t) => '- ' + t).join('\\n')
  : '';

const discoveryText = [
  'KLYNGER (velg ' + discoveryLimit + ' beste saker for dyp research):',
  lines.join('\\n\\n'),
  existingBlock,
  recentBlock,
  '\\n\\nReturner stories som JSON.',
].join('\\n');

return [{
  json: {
    ...input,
    discoveryText: discoveryText.slice(0, 14000),
    skipDiscovery: lines.length < 3,
    discoveryLimit,
  },
}];`;

const PREPARE_CLUSTER_SAVES_JS = `const gen = $input.first()?.json || {};
const ingest = $('Build discovery input').first()?.json || {};
const headlines = Array.isArray(ingest.headlines) ? ingest.headlines : [];
const recentClusterTitles = Array.isArray(ingest.recentClusterTitles) ? ingest.recentClusterTitles : [];

function stripCodeFence(text) {
  let t = String(text).trim();
  const fence = '\u0060\u0060\u0060';
  let i = t.toLowerCase().indexOf(fence + 'json');
  if (i >= 0) t = t.slice(i + 7);
  i = t.indexOf(fence);
  if (i >= 0) t = t.slice(0, i);
  return t.trim();
}

function parseStories(raw) {
  for (const c of [raw.output, raw.text, raw]) {
    if (!c) continue;
    if (typeof c === 'object' && Array.isArray(c.stories)) return c.stories;
    if (typeof c === 'string') {
      const s = stripCodeFence(c);
      const a = s.indexOf('{');
      const b = s.lastIndexOf('}');
      try {
        const p = JSON.parse(a >= 0 ? s.slice(a, b + 1) : s);
        if (p?.stories) return p.stories;
      } catch (_) {}
    }
  }
  return [];
}

function sqlEsc(s) {
  return String(s ?? '').replace(/'/g, "''");
}

function normTitle(t) {
  return String(t || '').toLowerCase().replace(/[^a-zæøå0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
}

function isDupTitle(title) {
  const n = normTitle(title);
  return recentClusterTitles.some((r) => normTitle(r) === n);
}

const out = [];
for (const story of parseStories(gen).slice(0, 6)) {
  const title = String(story.title || '').trim();
  const articles = (story.article_indices || [])
    .map((i) => headlines[Number(i)])
    .filter((h) => h?.url && h?.title);
  if (!title || articles.length < 3 || isDupTitle(title)) continue;

  const unique = [];
  const seen = new Set();
  for (const a of articles) {
    if (seen.has(a.url)) continue;
    seen.add(a.url);
    unique.push(a);
  }
  if (unique.length < 3) continue;

  const politicsScore = unique.reduce((s, a) => s + (Number(a.politicsScore) || 0), 0);
  const topicTags = (story.topic_tags || ['politikk']).map(String);
  const key = 'c' + story.cluster_id + '-' + normTitle(title).slice(0, 40);
  const rationale = String(story.why_interesting || '').slice(0, 500);
  const query =
    "INSERT INTO public.forum_research_clusters (external_cluster_key, title, discovery_rationale, topic_tags, politics_score, source_count, span_days, stortinget_issue_id, status) VALUES ('" +
    sqlEsc(key) +
    "', '" +
    sqlEsc(title) +
    "', '" +
    sqlEsc(rationale) +
    "', ARRAY[" +
    topicTags.map((t) => "'" + sqlEsc(t) + "'").join(',') +
    "], " +
    politicsScore +
    ', ' +
    unique.length +
    ", 0, NULL, 'pending') RETURNING id";

  out.push({ json: { query, title, articleRows: unique } });
}

if (!out.length) {
  return [{ json: { skipSave: true, query: 'SELECT 1 AS ok' } }];
}
return out;`;

const EXPAND_ARTICLE_SAVES_JS = `const items = $input.all();
const prepItems = $('Prepare cluster saves').all();
const results = [];

function sqlEsc(s) {
  return String(s ?? '').replace(/'/g, "''");
}

for (let i = 0; i < items.length; i++) {
  const saved = items[i].json || {};
  const clusterId = saved.id;
  if (!clusterId) continue;

  const prep = prepItems[i]?.json || {};
  const articles = Array.isArray(prep.articleRows) ? prep.articleRows : [];
  if (!articles.length) continue;

  for (let sortOrder = 0; sortOrder < articles.length; sortOrder++) {
    const a = articles[sortOrder];
    if (!a?.url || !a?.title) continue;
    const pub = a.publishedAt ? "'" + sqlEsc(new Date(a.publishedAt).toISOString()) + "'" : 'NULL';
    const articleSql =
      "INSERT INTO public.forum_research_articles (cluster_id, title, url, outlet, published_at, description, image_url, video_url, is_primary, sort_order) VALUES ('" +
      sqlEsc(clusterId) +
      "', '" +
      sqlEsc(a.title) +
      "', '" +
      sqlEsc(a.url) +
      "', '" +
      sqlEsc(a.outlet || '') +
      "', " +
      pub +
      ', ' +
      (a.description ? "'" + sqlEsc(String(a.description).slice(0, 500)) + "'" : 'NULL') +
      ', ' +
      (a.imageUrl ? "'" + sqlEsc(a.imageUrl) + "'" : 'NULL') +
      ', ' +
      (a.videoUrl ? "'" + sqlEsc(a.videoUrl) + "'" : 'NULL') +
      ', ' +
      (sortOrder === 0 ? 'true' : 'false') +
      ', ' +
      sortOrder +
      ') ON CONFLICT (cluster_id, url) DO NOTHING';
    results.push({ json: { articleSql, clusterId, title: prep.title } });
  }
}

return results;`;

const discoveryOllamaModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Discovery Ollama Chat Model',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'llama3.1:8b',
      options: { think: false, temperature: 0.2, format: 'json', numPredict: 1600, numCtx: 8192 },
    },
  },
});

const discoveryOutputParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Discovery JSON parser',
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample:
        '{"stories":[{"cluster_id":0,"title":"Kort sak","why_interesting":"Politisk debatt om X","priority":1,"topic_tags":["politikk"],"article_indices":[0,1,2]}]}',
      autoFix: true,
    },
    subnodes: { model: discoveryOllamaModel },
  },
});

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Hourly 00',
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '0 * * * *' }] },
    },
  },
  output: [{}],
});

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook manual',
    parameters: {
      path: 'folkets-forum-research-discovery',
      httpMethod: 'POST',
      responseMode: 'onReceived',
    },
  },
  output: [{ body: {} }],
});

const backfillSettings = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Backfill settings',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'searxng-base', name: 'searxngBaseUrl', value: 'https://searxng.heyklever.app', type: 'string' },
          { id: 'discovery-limit', name: 'discoveryLimit', value: '6', type: 'string' },
        ],
      },
    },
  },
  output: [{ searxngBaseUrl: 'https://searxng.heyklever.app', discoveryLimit: '6' }],
});

const fetchDiscoveryContext = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch discovery context',
    executeOnce: true,
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: { operation: 'executeQuery', query: DISCOVERY_CONTEXT_SQL },
  },
  output: [{ existing_questions: [], recent_cluster_titles: [] }],
});

const fetchLongRunningIssues = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch long-running saker',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query:
        "WITH issues AS (SELECT id, title, first_seen_at FROM public.stortinget_issues WHERE status = 'pending' AND first_seen_at IS NOT NULL AND first_seen_at < now() - interval '14 days' ORDER BY first_seen_at ASC LIMIT 10) SELECT id, title, first_seen_at FROM issues UNION ALL SELECT '_none_', 'Ingen langvarige saker', now() WHERE NOT EXISTS (SELECT 1 FROM issues)",
    },
  },
  output: [{ id: '200329', title: 'Eksempel sak', first_seen_at: '2025-01-01T00:00:00Z' }],
});

const fetchRssHeadlines = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Fetch RSS headlines',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: FETCH_RSS_DISCOVERY_JS,
    },
  },
  output: [{ rssHeadlines: [], rssCount: 0 }],
});

const collectHeadlines = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Collect headlines',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: COLLECT_HEADLINES_DISCOVERY_JS,
    },
  },
  output: [{ clusters: [], headlines: [], headlineCount: 0 }],
});

const buildDiscoveryInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build discovery input',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: BUILD_DISCOVERY_INPUT_JS,
    },
  },
  output: [{ discoveryText: 'KLYNGER...', skipDiscovery: false }],
});

const hasClusters = ifElse({
  version: 2.2,
  config: {
    name: 'Has clusters?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            leftValue: expr('{{ $json.skipDiscovery }}'),
            operator: { type: 'boolean', operation: 'false' },
          },
        ],
        combinator: 'and',
      },
    },
  },
});

const discoverStoriesAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Discover stories (Ollama)',
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.discoveryText }}'),
      hasOutputParser: true,
      options: {
        systemMessage: DISCOVERY_SYSTEM,
        maxIterations: 2,
        returnIntermediateSteps: false,
        enableStreaming: false,
      },
      subnodes: {
        model: discoveryOllamaModel,
        outputParser: discoveryOutputParser,
      },
    },
  },
  output: [{ output: { stories: [{ cluster_id: 0, title: 'Eksempel', article_indices: [0, 1, 2] }] } }],
});

const prepareClusterSaves = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare cluster saves',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: PREPARE_CLUSTER_SAVES_JS,
    },
  },
  output: [{ combinedSql: 'INSERT INTO public.forum_research_clusters...', title: 'Eksempel' }],
});

const saveCluster = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save cluster',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query: expr('{{ $json.query || $json.clusterSql }}'),
    },
  },
  output: [{ id: 'uuid-cluster-id' }],
});

const expandArticleSaves = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Expand article saves',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: EXPAND_ARTICLE_SAVES_JS,
    },
  },
  output: [{ articleSql: 'INSERT INTO public.forum_research_articles...' }],
});

const saveArticles = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save articles',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query: expr('{{ $json.articleSql }}'),
    },
  },
  output: [{ success: true }],
});

const triggerForumSynthesis = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Trigger forum synthesis',
    parameters: {
      source: 'database',
      workflowId: {
        __rl: true,
        mode: 'id',
        value: 'MloIdsnX7FozM4dv',
        cachedResultName: 'Folkets Stemme – Forum trending prompts',
      },
      mode: 'once',
      options: { waitForSubWorkflow: false },
    },
  },
  output: [{ executionId: 'sub-workflow-run' }],
});

sticky(
  '## Forum research discovery (v7 flow 1)\\n\\nFinner interessante saker → forum_research_clusters + articles. Ved suksess: Trigger forum synthesis (MloIdsnX7FozM4dv).',
  [scheduleTrigger, webhookTrigger],
  { color: 4 }
);

const discoverySavePipeline = prepareClusterSaves
  .to(saveCluster)
  .to(expandArticleSaves)
  .to(saveArticles)
  .to(triggerForumSynthesis);

const discoveryPipeline = backfillSettings
  .to(fetchDiscoveryContext)
  .to(fetchLongRunningIssues)
  .to(fetchRssHeadlines)
  .to(collectHeadlines)
  .to(buildDiscoveryInput)
  .to(hasClusters.onTrue(discoverStoriesAgent.to(discoverySavePipeline)));

export default workflow(
  'folkets-forum-research-discovery',
  'Folkets Stemme – Forum research discovery'
)
  .add(scheduleTrigger)
  .to(discoveryPipeline)
  .add(webhookTrigger)
  .to(discoveryPipeline);
