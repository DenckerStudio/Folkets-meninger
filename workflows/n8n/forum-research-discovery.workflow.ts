/**
 * Folkets Stemme – Forum research discovery + synthesis (v8 single pipeline)
 * RSS cluster → Discover (SearXNG tool) → enrich → save clusters/articles → per-cluster synthesis → forum_prompts
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
  tool,
  outputParser,
  splitInBatches,
  nextBatch,
  expr,
} from '@n8n/workflow-sdk';
import {
  DISCOVERY_CONTEXT_SQL,
  FETCH_RSS_DISCOVERY_JS,
  RSS_CLUSTER_JS,
} from './forum-prompt-ingest.shared';
import {
  DEEP_RESEARCH_SYSTEM,
  JOURNALIST_SYSTEM,
  EDITOR_SYSTEM,
  BUILD_DEEP_RESEARCH_INPUT_JS,
  BUILD_JOURNALIST_INPUT_JS,
  BUILD_EDITOR_INPUT_JS,
  FINALIZE_PROMPTS_JS,
  PREPARE_SAVES_JS,
  CHECK_DUPLICATE_TOOL_JS,
  EXISTING_PROMPTS_SQL,
  TRUSTED_SOURCES_SQL,
  EXPAND_SAVED_CLUSTER_JS,
  RESET_RUN_STATIC_JS,
} from './forum-prompt-synthesis.shared';
import { ENRICH_STORY_ARTICLES_JS } from './forum-article-enrich.shared';

const DISCOVERY_SYSTEM = `Du er nyhetsredaktør for «Folkets Stemme». Du skal finne 3–6 politiske saker som er gode kandidater for dyp research og senere JA/NEI-avstemninger.

Du har verktøyet SearXNG for å supplere klynger med flere relevante artikler (norsk politikk, siste 72 timer).

INPUT: Klynger med overskrifter (flere medier om samme sak). Du får EXISTING_PROMPTS og RECENT_CLUSTERS (siste 72t) – ikke foreslå samme tema på nytt.

Oppgave:
1. Velg kun klynger med tydelig politisk konflikt, forslag, vedtak eller valg folk kan ta stilling til
2. Hver valgt klynge må ha minst 3 artikler; prioriter artikler publisert innen 72 timer
3. Forklar kort hvorfor saken er interessant NÅ (ny utvikling, debatt, konsekvens for folk)
4. Prioriter saker med flere kilder og nyere artikler

AVSLÅ klynger som:
- Ren sport, kjendis, kongehus uten politisk beslutning
- Vage «debatt om X» uten konkret politisk handling
- Allerede dekket av EXISTING_PROMPTS eller RECENT_CLUSTERS (nær-duplikat tema/tittel)
- Hovedsakelig artikler eldre enn 72 timer uten tydelig ny vinkel

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
  return [];
}

const ranked = [...clusters].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 14);
const indexByUrl = new Map();
headlines.forEach((h, i) => indexByUrl.set(h.url, i));

const lines = [];
for (const c of ranked) {
  const items = (c.items || []).filter((h) => {
    if (h.longRunning) return true;
    if (h.isPolitical === true) return true;
    if (h.isPolitical === false) return false;
    return (Number(h.politicsScore) || 0) >= 1;
  });
  if (items.length < 2) continue;
  lines.push('=== KLYNGE ' + c.id + ' (score=' + (c.score || 0) + ', spanDays=' + (c.spanDays || 0) + ') ===');
  for (const h of items.slice(0, 8)) {
    const idx = indexByUrl.get(h.url);
    if (idx == null) continue;
    const pub = h.publishedAt ? String(h.publishedAt).slice(0, 16) : '';
    lines.push('[' + idx + '] ' + h.title + ' (' + h.outlet + (pub ? ', ' + pub : '') + ')\\n    ' + h.url);
  }
}

if (!lines.length && headlines.length) {
  const political = headlines
    .filter((h) => h.longRunning || (Number(h.politicsScore) || 0) >= 1 || h.isPolitical !== false)
    .slice(0, 18);
  if (political.length >= 2) {
    lines.push('=== RSS-SEED (agent: grupper til saker, suppler med SearXNG til minst 3 kilder per sak) ===');
    for (const h of political) {
      const idx = indexByUrl.get(h.url);
      if (idx == null) continue;
      const pub = h.publishedAt ? String(h.publishedAt).slice(0, 16) : '';
      lines.push('[' + idx + '] ' + h.title + ' (' + h.outlet + (pub ? ', ' + pub : '') + ')\\n    ' + h.url);
    }
  }
}

if (!lines.length) {
  return [];
}

const existingBlock = existingQuestions.length
  ? '\\n\\nEXISTING_PROMPTS (ikke foreslå samme tema):\\n' + existingQuestions.slice(0, 35).map((q) => '- ' + q).join('\\n')
  : '';
const recentBlock = recentClusterTitles.length
  ? '\\n\\nRECENT_CLUSTERS (siste 72t – unngå duplikat tema):\\n' + recentClusterTitles.slice(0, 25).map((t) => '- ' + t).join('\\n')
  : '';

const discoveryText = [
  'KLYNGER (velg ' + discoveryLimit + ' beste saker; prioriter artikler < 72t):',
  lines.join('\\n\\n'),
  existingBlock,
  recentBlock,
  '\\n\\nBruk SearXNG ved behov for flere kilder. Returner stories som JSON.',
].join('\\n');

return [{
  json: {
    ...input,
    discoveryText: discoveryText.slice(0, 14000),
    discoveryLimit,
  },
}];`;

const PREPARE_CLUSTER_SAVES_JS = `const gen = $input.first()?.json || {};
const ingest = $('Enrich story articles').first()?.json || $('Build discovery input').first()?.json || {};
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
  const stortId = story.stortinget_issue_id ? "'" + sqlEsc(String(story.stortinget_issue_id)) + "'" : 'NULL';
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
    ", 0, " +
    stortId +
    ", 'pending') RETURNING id";

  out.push({
    json: {
      query,
      title,
      articleRows: unique,
      discoveryRationale: rationale,
      topicTags,
      stortingetIssueId: story.stortinget_issue_id || null,
    },
  });
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

function sqlText(val) {
  if (val == null || val === '') return 'NULL';
  return "'" + sqlEsc(String(val).slice(0, 12000)) + "'";
}

for (let i = 0; i < items.length; i++) {
  const saved = items[i].json || {};
  const clusterId = saved.id;
  if (!clusterId || saved.skipSave) continue;

  const prep = prepItems[i]?.json || {};
  const articles = Array.isArray(prep.articleRows) ? prep.articleRows : [];
  if (!articles.length) continue;

  for (let sortOrder = 0; sortOrder < articles.length; sortOrder++) {
    const a = articles[sortOrder];
    if (!a?.url || !a?.title) continue;
    const pub = a.publishedAt ? "'" + sqlEsc(new Date(a.publishedAt).toISOString()) + "'" : 'NULL';
    const articleSql =
      "INSERT INTO public.forum_research_articles (cluster_id, title, url, outlet, published_at, description, image_url, video_url, article_text, article_fetch_status, is_primary, sort_order) VALUES ('" +
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
      sqlText(a.articleText) +
      ', ' +
      (a.articleFetchStatus ? "'" + sqlEsc(a.articleFetchStatus) + "'" : 'NULL') +
      ', ' +
      (sortOrder === 0 ? 'true' : 'false') +
      ', ' +
      sortOrder +
      ') ON CONFLICT (cluster_id, url) DO UPDATE SET article_text = EXCLUDED.article_text, article_fetch_status = EXCLUDED.article_fetch_status';
    results.push({
      json: {
        articleSql,
        clusterId,
        title: prep.title,
        discoveryRationale: prep.discoveryRationale,
        topicTags: prep.topicTags,
        stortingetIssueId: prep.stortingetIssueId,
        articleRows: articles,
      },
    });
  }
}

return results.length ? results : [{ json: { skipArticles: true, articleSql: 'SELECT 1 AS ok' } }];`;

const QUEUE_SAVED_CLUSTERS_JS = `const saves = $('Save cluster').all();
const prepItems = $('Prepare cluster saves').all();
const out = [];

for (let i = 0; i < saves.length; i++) {
  const row = saves[i].json || {};
  if (!row.id || row.skipSave) continue;
  const prep = prepItems[i]?.json || {};
  const articleRows = Array.isArray(prep.articleRows) ? prep.articleRows : [];
  if (!articleRows.length) continue;
  out.push({
    json: {
      clusterId: row.id,
      title: prep.title,
      discoveryRationale: prep.discoveryRationale || '',
      topicTags: prep.topicTags || [],
      stortingetIssueId: prep.stortingetIssueId || null,
      articleRows,
    },
  });
}

if (!out.length) return [];
return out;`;

const MARK_CLUSTER_COMPLETED_JS = `const fin = $('Finalize prompts').first()?.json || {};
const clusterId = fin.clusterId || $('Expand from saved').first()?.json?.clusterId;
if (!clusterId) {
  return [{ json: { skipMark: true, query: 'SELECT 1 AS ok' } }];
}
const esc = (s) => String(s ?? '').replace(/'/g, "''");
const drEsc = esc(JSON.stringify(fin.deepResearch || {}));
const query =
  "UPDATE public.forum_research_clusters SET status = 'completed', deep_research_json = '" +
  drEsc +
  "'::jsonb, processed_at = now(), updated_at = now() WHERE id = '" +
  esc(clusterId) +
  "'";
return [{ json: { query, clusterId } }];`;

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

const synthesisOllamaModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Synthesis Ollama Chat Model',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'llama3.1:8b',
      options: { think: false, temperature: 0.15, format: 'default', numPredict: 2400, numCtx: 8192 },
    },
  },
});

const deepResearchOllamaModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Deep research Ollama Chat Model',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'llama3.1:8b',
      options: { think: false, temperature: 0.15, format: 'json', numPredict: 2000, numCtx: 8192 },
    },
  },
});

const editorOllamaModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Editor Ollama Chat Model',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'llama3.1:8b',
      options: { think: false, temperature: 0.1, format: 'json', numPredict: 1400, numCtx: 8192 },
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
        '{"stories":[{"cluster_id":0,"title":"Kort sak","why_interesting":"Politisk debatt","priority":1,"topic_tags":["politikk"],"article_indices":[0,1,2]}]}',
      autoFix: true,
    },
    subnodes: { model: discoveryOllamaModel },
  },
});

const deepResearchOutputParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Deep research JSON parser',
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample:
        '{"story_title":"Sak","summary":"Kort","shared_facts":["fakta"],"disagreements":["uenighet"],"political_choice":"Valg","poll_angles":["vinkel"],"source_quality":"god","confidence":"high"}',
      autoFix: true,
    },
    subnodes: { model: deepResearchOllamaModel },
  },
});

const editorOutputParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Editor JSON parser',
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample:
        '{"approved_prompts":[{"question":"Støtter du X?","novelty_explanation":"…","source_indices":[0,1,2],"topic_tags":["politikk"],"sensitivity":"low","status":"active"}],"rejected":[]}',
      autoFix: true,
    },
    subnodes: { model: editorOllamaModel },
  },
});

const searxngDiscoveryTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolSearXng',
  version: 1,
  config: {
    name: 'searxng_discovery',
    credentials: { searXngApi: newCredential('SearXNG account') },
    parameters: {},
  },
});

const checkDuplicateTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolCode',
  version: 1.3,
  config: {
    name: 'check_duplicate',
    parameters: {
      description:
        'Check duplicate forum poll questions. Call with JSON: {"question":"Støtter du ...?"}. Returns DUPLICATE or OK.',
      language: 'javaScript',
      specifyInputSchema: true,
      schemaType: 'fromJson',
      jsonSchemaExample: '{"question":"Støtter du nasjonalt forbud mot lasere?"}',
      jsCode: CHECK_DUPLICATE_TOOL_JS,
    },
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
          { id: 'discovery-limit', name: 'discoveryLimit', value: '6', type: 'string' },
          { id: 'batch-limit', name: 'batchLimit', value: '10', type: 'string' },
          { id: 'max-age', name: 'maxArticleAgeHours', value: '72', type: 'string' },
        ],
      },
    },
  },
  output: [{ discoveryLimit: '6', batchLimit: '10' }],
});

const resetRunStatic = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Reset run dedup state',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: RESET_RUN_STATIC_JS,
    },
  },
  output: [{ reset: true }],
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

const clusterHeadlines = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Cluster headlines',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: RSS_CLUSTER_JS,
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
  output: [{ discoveryText: 'KLYNGER...' }],
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
      hasOutputParser: false,
      options: {
        systemMessage: DISCOVERY_SYSTEM,
        maxIterations: 4,
        returnIntermediateSteps: false,
        enableStreaming: false,
      },
      subnodes: {
        model: discoveryOllamaModel,
        tools: [searxngDiscoveryTool],
      },
    },
  },
  output: [{ output: { stories: [{ cluster_id: 0, title: 'Eksempel', article_indices: [0, 1, 2] }] } }],
});

const enrichStoryArticles = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Enrich story articles',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: ENRICH_STORY_ARTICLES_JS,
    },
  },
  output: [{ headlines: [], articlesFetched: 0 }],
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
  output: [{ query: 'INSERT INTO public.forum_research_clusters...', title: 'Eksempel' }],
});

const saveCluster = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save cluster',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query: expr('{{ $json.query }}'),
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

const fetchExistingPrompts = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch existing prompts',
    executeOnce: true,
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: { operation: 'executeQuery', query: EXISTING_PROMPTS_SQL },
  },
  output: [{ existing_questions: [], max_sort_order: 0 }],
});

const fetchTrustedSources = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch trusted sources',
    executeOnce: true,
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: { operation: 'executeQuery', query: TRUSTED_SOURCES_SQL },
  },
  output: [{ trusted_sources: [] }],
});

const queueSavedClusters = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Queue saved clusters',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: QUEUE_SAVED_CLUSTERS_JS,
    },
  },
  output: [{ clusterId: 'uuid', title: 'Eksempel', articleRows: [] }],
});

const processOneCluster = splitInBatches({
  version: 3,
  config: {
    name: 'Process one cluster',
    parameters: { batchSize: 1 },
  },
});

const expandFromSaved = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Expand from saved',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: EXPAND_SAVED_CLUSTER_JS,
    },
  },
  output: [{ clusterId: 'uuid', headlines: [], skipAgent: false }],
});

const buildDeepResearchInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build deep research input',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: BUILD_DEEP_RESEARCH_INPUT_JS,
    },
  },
  output: [{ deepResearchText: 'SAK: ...' }],
});

const deepResearchAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Deep research (Ollama)',
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.deepResearchText }}'),
      hasOutputParser: true,
      options: {
        systemMessage: DEEP_RESEARCH_SYSTEM,
        maxIterations: 2,
        returnIntermediateSteps: false,
        enableStreaming: false,
      },
      subnodes: {
        model: deepResearchOllamaModel,
        outputParser: deepResearchOutputParser,
      },
    },
  },
  output: [{ output: { summary: 'Oppsummering', political_choice: 'Valg', confidence: 'medium' } }],
});

const buildJournalistInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build journalist input',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: BUILD_JOURNALIST_INPUT_JS,
    },
  },
  output: [{ headlinesText: 'KILDER...', skipAgent: false }],
});

const journalistAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Journalist (Ollama)',
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.headlinesText }}'),
      hasOutputParser: false,
      options: {
        systemMessage: JOURNALIST_SYSTEM,
        maxIterations: 6,
        returnIntermediateSteps: true,
        enableStreaming: false,
      },
      subnodes: {
        model: synthesisOllamaModel,
        tools: [checkDuplicateTool],
      },
    },
  },
  output: [{ output: { prompts: [{ question: 'Støtter du X?', source_indices: [0, 1, 2] }] } }],
});

const buildEditorInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build editor input',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: BUILD_EDITOR_INPUT_JS,
    },
  },
  output: [{ moderationText: 'KANDIDAT...', candidateCount: 1 }],
});

const editorAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Editor (Ollama)',
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.moderationText }}'),
      hasOutputParser: true,
      options: {
        systemMessage: EDITOR_SYSTEM,
        maxIterations: 3,
        returnIntermediateSteps: false,
        enableStreaming: false,
      },
      subnodes: {
        model: editorOllamaModel,
        outputParser: editorOutputParser,
      },
    },
  },
  output: [
    {
      output: {
        approved_prompts: [{ question: 'Støtter du X?', source_indices: [0, 1, 2], status: 'active' }],
        rejected: [],
      },
    },
  ],
});

const finalizePrompts = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Finalize prompts',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: FINALIZE_PROMPTS_JS,
    },
  },
  output: [{ approvedPrompts: [], clusterId: 'uuid' }],
});

const prepareSaves = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare saves',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: PREPARE_SAVES_JS,
    },
  },
  output: [{ sql: 'INSERT INTO public.forum_prompts...' }],
});

const savePrompt = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save prompt',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query: expr('{{ $json.sql }}'),
    },
  },
  output: [{ success: true }],
});

const markClusterCompleted = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Mark cluster completed',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query: expr('{{ $json.query }}'),
    },
  },
  output: [{ success: true }],
});

const markClusterCompletedPrep = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare mark completed',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: MARK_CLUSTER_COMPLETED_JS,
    },
  },
  output: [{ query: 'UPDATE public.forum_research_clusters...' }],
});

sticky(
  '## Forum research v8 (single pipeline)\\n\\nRSS cluster → Discover (+ SearXNG tool) → enrich → save → per-cluster: deep research → journalist (1 spørsmål) → editor → forum_prompts. Ingen Execute Workflow til MloIdsnX7FozM4dv.',
  [scheduleTrigger, webhookTrigger],
  { color: 4 }
);

const clusterSynthesisPipeline = expandFromSaved
  .to(buildDeepResearchInput)
  .to(deepResearchAgent)
  .to(buildJournalistInput)
  .to(journalistAgent)
  .to(buildEditorInput)
  .to(editorAgent)
  .to(finalizePrompts)
  .to(prepareSaves)
  .to(savePrompt)
  .to(markClusterCompletedPrep)
  .to(markClusterCompleted)
  .to(nextBatch(processOneCluster));

const discoverySavePipeline = discoverStoriesAgent
  .to(enrichStoryArticles)
  .to(prepareClusterSaves)
  .to(saveCluster)
  .to(expandArticleSaves)
  .to(saveArticles)
  .to(fetchExistingPrompts)
  .to(fetchTrustedSources)
  .to(queueSavedClusters)
  .to(
    processOneCluster.onEachBatch(clusterSynthesisPipeline)
  );

const discoveryPipeline = backfillSettings
  .to(resetRunStatic)
  .to(fetchDiscoveryContext)
  .to(fetchLongRunningIssues)
  .to(fetchRssHeadlines)
  .to(clusterHeadlines)
  .to(buildDiscoveryInput)
  .to(discoverySavePipeline);

export default workflow(
  'folkets-forum-research-discovery',
  'Folkets Stemme – Forum research discovery (v8)'
)
  .add(scheduleTrigger)
  .to(discoveryPipeline)
  .add(webhookTrigger)
  .to(discoveryPipeline);
