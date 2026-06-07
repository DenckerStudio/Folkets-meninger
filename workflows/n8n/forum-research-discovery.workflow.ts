/**
 * @deprecated v12 — use forum-regjeringen-rss-ingest.workflow.ts + forum-prompt-generator.workflow.ts
 * Folkets Stemme – Forum story scout (v11.1)
 * Code: 4 RSS feeds → politics filter → token cluster → debatten prefetch
 * AI: én agent velger 1 sak + SearXNG (fallback)
 * Code: enrich → quality gate → dedup → transactional insert
 *
 * Webhook: POST folkets-forum-research-discovery
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
  ifElse,
  expr,
} from '@n8n/workflow-sdk';
import { DISCOVERY_CONTEXT_SQL, SCOUT_PICK_SYSTEM } from './forum-workflow.shared';
import {
  SCOUT_INGEST_AND_CLUSTER_JS,
  SCOUT_PREFETCH_DEBATTEN_JS,
  SCOUT_LOG_EMPTY_INGEST_JS,
  SCOUT_BUILD_INSERT_QUERY_JS,
  SCOUT_ENRICH_ARTICLES_JS,
  NRK_DEBATTEN_SEARXNG_HINT,
} from './forum-scout-ingest.shared';

const scoutAgentOllamaModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Scout Ollama Chat Model',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'llama3.1:8b',
      options: { think: false, temperature: 0.15, numPredict: 1200, numCtx: 8192 },
    },
  },
});

const scoutParserOllamaModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Scout parser Ollama',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'llama3.2:3b-text-q4_K_M',
      options: { think: false, temperature: 0, format: 'json', numPredict: 1400, numCtx: 8192 },
    },
  },
});

const scoutOutputParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Scout JSON parser',
    onError: 'continueRegularOutput',
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample:
        '{"selected_candidate_index":0,"why_interesting":"Politisk valg","topic_tags":["politikk"],"extra_articles":[{"title":"Tittel","url":"https://nrk.no/1","outlet":"NRK"}],"debatten_article":null}',
      autoFix: true,
    },
    subnodes: { model: scoutParserOllamaModel },
  },
});

const searxngScoutTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolSearXng',
  version: 1,
  config: {
    name: 'SearXNG',
    credentials: { searXngApi: newCredential('SearXNG account') },
    parameters: {
      options: { numResults: 5, language: 'nb', safesearch: 0 },
    },
  },
});

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Every 30 min',
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '*/30 * * * *' }] },
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

const fetchDiscoveryContext = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch discovery context',
    executeOnce: true,
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: { operation: 'executeQuery', query: DISCOVERY_CONTEXT_SQL },
  },
  output: [{ existing_questions: [], recent_story_titles: [], recent_story_keys: [] }],
});

const ingestAndCluster = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Ingest and cluster',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: SCOUT_INGEST_AND_CLUSTER_JS,
    },
  },
  output: [{ candidates: [], stats: { candidates_count: 0 } }],
});

const prefetchDebatten = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prefetch debatten',
    executeOnce: true,
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: SCOUT_PREFETCH_DEBATTEN_JS,
    },
  },
});

const logEmptyIngest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Log empty ingest',
    executeOnce: true,
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: SCOUT_LOG_EMPTY_INGEST_JS,
    },
  },
});

const hasCandidates = ifElse({
  version: 2.2,
  config: {
    name: 'Has candidates?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            leftValue:
              "={{ (() => { const c = $('Prefetch debatten').first().json.candidates || []; return c.length >= 1 && c[0].articles?.length >= 2; })() }}",
            rightValue: true,
            operator: { type: 'boolean', operation: 'equals' },
          },
        ],
        combinator: 'and',
      },
    },
  },
});

const buildPickPrompt = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Build pick prompt',
    executeOnce: true,
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          {
            id: 'pick-text',
            name: 'pickText',
            value:
              `={{ (() => { const ctx = $('Fetch discovery context').first().json; const ingest = $('Prefetch debatten').first().json; const ex = (ctx.existing_questions || []).slice(0, 15).map((q) => '- ' + q).join('\\n'); const rec = (ctx.recent_story_titles || []).slice(0, 12).map((t) => '- ' + t).join('\\n'); const keys = (ctx.recent_story_keys || []).slice(0, 15).map((k) => '- ' + k).join('\\n'); const debPrefetch = (ingest.debatten_prefetch || []).map((d, i) => d ? '[' + i + '] ' + d.title + ' (' + d.url + ')' : '[' + i + '] (ingen)').join('\\n'); const cards = (ingest.candidates || []).map((c, i) => { const arts = (c.articles || []).slice(0, 4).map((a, j) => '  [' + j + '] ' + a.title + ' (' + a.outlet + ')').join('\\n'); return '[' + i + '] ' + c.story_title + ' (score ' + c.politics_score + ', ' + c.outlet_count + ' medier)\\n' + arts; }).join('\\n\\n'); const debHint = ${JSON.stringify(NRK_DEBATTEN_SEARXNG_HINT)}; const stats = ingest.stats || {}; return 'INGEST_STATS: rss_raw=' + (stats.rss_raw || 0) + ' junk=' + (stats.filtered_junk || 0) + ' politics=' + (stats.filtered_politics || 0) + ' candidates=' + (stats.candidates_count || 0) + '\\n\\nSAKSKLYNGER (velg ÉN):\\n' + (cards || '(ingen)') + '\\n\\nDEBATTEN_PREFETCH:\\n' + (debPrefetch || '(ingen)') + '\\n\\nNRK_DEBATTEN: ' + debHint + '\\n\\nEXISTING_PROMPTS:\\n' + (ex || '(ingen)') + '\\n\\nRECENT_STORIES:\\n' + (rec || '(ingen)') + '\\n\\nRECENT_KEYS:\\n' + (keys || '(ingen)'); })() }}`,
            type: 'string',
          },
        ],
      },
    },
  },
});

const storyScoutAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Story scout (Ollama)',
    executeOnce: true,
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.pickText }}'),
      hasOutputParser: true,
      options: {
        systemMessage: SCOUT_PICK_SYSTEM,
        maxIterations: 3,
        returnIntermediateSteps: false,
        enableStreaming: false,
      },
      subnodes: {
        model: scoutAgentOllamaModel,
        outputParser: scoutOutputParser,
        tools: [searxngScoutTool],
      },
    },
  },
});

const normalizePick = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Normalize pick',
    executeOnce: true,
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          {
            id: 'story-title',
            name: 'story_title',
            value:
              "={{ (() => { const out = $json.output || {}; const idx = Number.isFinite(Number(out.selected_candidate_index)) ? Number(out.selected_candidate_index) : 0; const cands = $('Prefetch debatten').first().json.candidates || []; const picked = cands[idx] || cands[0] || {}; return String(picked.story_title || '').slice(0, 160); })() }}",
            type: 'string',
          },
          {
            id: 'why',
            name: 'why_interesting',
            value:
              "={{ $json.output?.why_interesting || 'Politisk sak fra dagens nyhetsbilde.' }}",
            type: 'string',
          },
          {
            id: 'tags',
            name: 'topic_tags',
            value:
              "={{ (() => { const t = $json.output?.topic_tags; if (Array.isArray(t) && t.length) return t.map(String); return ['politikk']; })() }}",
            type: 'array',
          },
          {
            id: 'story-key',
            name: 'story_key',
            value:
              "={{ (() => { const out = $json.output || {}; const idx = Number.isFinite(Number(out.selected_candidate_index)) ? Number(out.selected_candidate_index) : 0; const cands = $('Prefetch debatten').first().json.candidates || []; const picked = cands[idx] || cands[0] || {}; return picked.story_key || String(picked.story_title || '').toLowerCase().replace(/[^a-zæøå0-9]+/gi, ' ').trim().slice(0, 80); })() }}",
            type: 'string',
          },
          {
            id: 'politics-score',
            name: 'politics_score',
            value:
              "={{ (() => { const out = $json.output || {}; const idx = Number.isFinite(Number(out.selected_candidate_index)) ? Number(out.selected_candidate_index) : 0; const cands = $('Prefetch debatten').first().json.candidates || []; return (cands[idx] || cands[0] || {}).politics_score || 0; })() }}",
            type: 'number',
          },
          {
            id: 'candidate-index',
            name: 'candidate_index',
            value:
              "={{ (() => { const out = $json.output || {}; return Number.isFinite(Number(out.selected_candidate_index)) ? Number(out.selected_candidate_index) : 0; })() }}",
            type: 'number',
          },
          {
            id: 'scout-meta',
            name: 'scout_metadata',
            value:
              "={{ (() => { const out = $json.output || {}; const idx = Number.isFinite(Number(out.selected_candidate_index)) ? Number(out.selected_candidate_index) : 0; const ingest = $('Prefetch debatten').first().json; const picked = (ingest.candidates || [])[idx] || (ingest.candidates || [])[0] || {}; const prefetched = (ingest.debatten_prefetch || [])[idx]; const deb = out.debatten_article || prefetched; const articles = Array.isArray(picked.articles) ? picked.articles : []; const fetchStatuses = articles.map(() => 'pending'); return { outlet_count: picked.outlet_count, outlets: picked.outlets, cluster_score: picked.cluster_score, ingest_stats: ingest.stats, debatten_used: !!(deb && deb.url), debatten_prefetched: !!prefetched, selected_index: idx, fetch_statuses: fetchStatuses }; })() }}",
            type: 'object',
          },
          {
            id: 'articles',
            name: 'articles',
            value:
              "={{ (() => { const out = $json.output || {}; const idx = Number.isFinite(Number(out.selected_candidate_index)) ? Number(out.selected_candidate_index) : 0; const ingest = $('Prefetch debatten').first().json; const picked = (ingest.candidates || [])[idx] || (ingest.candidates || [])[0] || {}; let articles = Array.isArray(picked.articles) ? [...picked.articles] : []; const urls = new Set(articles.map((a) => a.url).filter(Boolean)); const prefetched = (ingest.debatten_prefetch || [])[idx]; const deb = out.debatten_article || prefetched; for (const a of [...(out.extra_articles || []), deb].filter(Boolean)) { if (a?.url && !urls.has(a.url)) { articles.push({ title: a.title, url: a.url, outlet: a.outlet || 'Nyhet', description: a.description || null, published_at: a.published_at || null, image_url: a.image_url || null }); urls.add(a.url); } } return articles.slice(0, 6); })() }}",
            type: 'array',
          },
        ],
      },
    },
  },
});

const enrichArticles = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Enrich articles',
    executeOnce: true,
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: SCOUT_ENRICH_ARTICLES_JS,
    },
  },
});

const updateScoutMetadata = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Update scout metadata',
    executeOnce: true,
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          {
            id: 'scout-meta',
            name: 'scout_metadata',
            value:
              "={{ (() => { const d = $json; const meta = { ...(d.scout_metadata || {}) }; const arts = d.articles || []; meta.fetch_statuses = arts.map((a) => a.source_payload?.fetch_status || 'unknown'); meta.enrich_stats = d.enrich_stats; return meta; })() }}",
            type: 'object',
          },
        ],
      },
    },
  },
});

const passesQualityGate = ifElse({
  version: 2.2,
  config: {
    name: 'Quality gate',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            leftValue:
              "={{ (() => { const d = $('Update scout metadata').first().json; return (d.quality_source_count || 0) >= 2 && (d.articles || []).length >= 2 && String(d.story_title || '').trim().length >= 15; })() }}",
            rightValue: true,
            operator: { type: 'boolean', operation: 'equals' },
          },
        ],
        combinator: 'and',
      },
    },
  },
});

const checkDuplicateStory = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Check duplicate',
    executeOnce: true,
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query:
        "={{ (() => { const d = $('Update scout metadata').first().json; const esc = (s) => String(s || '').replace(/'/g, \"''\"); const title = esc(d.story_title); const urls = (d.articles || []).map((a) => esc(a.url)).filter(Boolean); const inList = urls.length ? urls.map((u) => `'${u}'`).join(',') : \"''\"; return `SELECT (EXISTS (SELECT 1 FROM public.forum_research_clusters c WHERE c.created_at > now() - interval '72 hours' AND c.status NOT IN ('rejected', 'failed') AND (lower(trim(c.title)) = lower(trim('${title}')) OR (length(trim('${title}')) >= 12 AND (lower(trim(c.title)) LIKE '%' || lower(trim('${title}')) || '%' OR lower(trim('${title}')) LIKE '%' || lower(trim(c.title)) || '%'))))) AS duplicate_title, (SELECT COUNT(DISTINCT a.url)::int FROM public.forum_research_articles a JOIN public.forum_research_clusters c ON c.id = a.cluster_id WHERE c.created_at > now() - interval '72 hours' AND c.status NOT IN ('rejected', 'failed') AND a.url IN (${inList})) AS url_overlap`; })() }}",
    },
  },
});

const prepareInsert = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Prepare insert',
    executeOnce: true,
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          {
            id: 'story-title',
            name: 'story_title',
            value: "={{ $('Update scout metadata').first().json.story_title }}",
            type: 'string',
          },
          {
            id: 'why',
            name: 'why_interesting',
            value: "={{ $('Update scout metadata').first().json.why_interesting }}",
            type: 'string',
          },
          {
            id: 'tags',
            name: 'topic_tags',
            value: "={{ $('Update scout metadata').first().json.topic_tags }}",
            type: 'array',
          },
          {
            id: 'articles',
            name: 'articles',
            value: "={{ $('Update scout metadata').first().json.articles }}",
            type: 'array',
          },
          {
            id: 'story-key',
            name: 'story_key',
            value: "={{ $('Update scout metadata').first().json.story_key }}",
            type: 'string',
          },
          {
            id: 'politics-score',
            name: 'politics_score',
            value: "={{ $('Update scout metadata').first().json.politics_score }}",
            type: 'number',
          },
          {
            id: 'scout-meta',
            name: 'scout_metadata',
            value: "={{ $('Update scout metadata').first().json.scout_metadata }}",
            type: 'object',
          },
          {
            id: 'candidate-index',
            name: 'candidate_index',
            value: "={{ $('Update scout metadata').first().json.candidate_index ?? 0 }}",
            type: 'number',
          },
          {
            id: 'dup-title',
            name: 'duplicate_title',
            value: '={{ $json.duplicate_title }}',
            type: 'boolean',
          },
          {
            id: 'url-overlap',
            name: 'url_overlap',
            value: '={{ $json.url_overlap }}',
            type: 'number',
          },
        ],
      },
    },
  },
});

const notDuplicate = ifElse({
  version: 2.2,
  config: {
    name: 'Not duplicate?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            leftValue:
              "={{ $json.duplicate_title === true || ($json.url_overlap || 0) >= 3 || ($json.articles || []).length < 2 || String($json.story_title || '').trim().length < 15 }}",
            rightValue: true,
            operator: { type: 'boolean', operation: 'notEquals' },
          },
        ],
        combinator: 'and',
      },
    },
  },
});

const buildInsertQuery = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build insert query',
    executeOnce: true,
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: SCOUT_BUILD_INSERT_QUERY_JS,
    },
  },
});

const insertClusterTransaction = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Insert cluster transaction',
    executeOnce: true,
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query: '={{ $json.query }}',
    },
  },
});

const prepareSecondCandidate = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Prepare second candidate',
    executeOnce: true,
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          {
            id: 'story-title',
            name: 'story_title',
            value:
              "={{ (() => { const ingest = $('Prefetch debatten').first().json; const second = (ingest.candidates || [])[1]; return String(second?.story_title || '').slice(0, 160); })() }}",
            type: 'string',
          },
          {
            id: 'why',
            name: 'why_interesting',
            value:
              "={{ (() => { const ingest = $('Prefetch debatten').first().json; const second = (ingest.candidates || [])[1]; return 'Alternativ politisk sak fra dagens nyhetsbilde: ' + (second?.story_title || ''); })() }}",
            type: 'string',
          },
          {
            id: 'tags',
            name: 'topic_tags',
            value: "={{ ['politikk'] }}",
            type: 'array',
          },
          {
            id: 'story-key',
            name: 'story_key',
            value:
              "={{ (() => { const ingest = $('Prefetch debatten').first().json; const second = (ingest.candidates || [])[1]; return second?.story_key || ''; })() }}",
            type: 'string',
          },
          {
            id: 'politics-score',
            name: 'politics_score',
            value:
              "={{ (() => { const ingest = $('Prefetch debatten').first().json; return (ingest.candidates || [])[1]?.politics_score || 0; })() }}",
            type: 'number',
          },
          {
            id: 'candidate-index',
            name: 'candidate_index',
            value: '={{ 1 }}',
            type: 'number',
          },
          {
            id: 'scout-meta',
            name: 'scout_metadata',
            value:
              "={{ (() => { const ingest = $('Prefetch debatten').first().json; const second = (ingest.candidates || [])[1] || {}; const deb = (ingest.debatten_prefetch || [])[1]; return { outlet_count: second.outlet_count, outlets: second.outlets, cluster_score: second.cluster_score, ingest_stats: ingest.stats, debatten_used: !!deb, debatten_prefetched: !!deb, selected_index: 1, second_candidate: true, fetch_statuses: (second.articles || []).map(() => 'pending') }; })() }}",
            type: 'object',
          },
          {
            id: 'articles',
            name: 'articles',
            value:
              "={{ (() => { const ingest = $('Prefetch debatten').first().json; const second = (ingest.candidates || [])[1]; let articles = Array.isArray(second?.articles) ? [...second.articles] : []; const deb = (ingest.debatten_prefetch || [])[1]; if (deb?.url && !articles.some((a) => a.url === deb.url)) articles.push(deb); return articles.slice(0, 6); })() }}",
            type: 'array',
          },
        ],
      },
    },
  },
});

const hasSecondCandidate = ifElse({
  version: 2.2,
  config: {
    name: 'Has second candidate?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            leftValue:
              "={{ (() => { const ingest = $('Prefetch debatten').first().json; const idx = $('Prepare insert').first().json.candidate_index ?? 0; if (idx !== 0) return false; const first = (ingest.candidates || [])[0]; const second = (ingest.candidates || [])[1]; return !!(second && second.story_key && second.story_key !== first?.story_key && (second.articles || []).length >= 2); })() }}",
            rightValue: true,
            operator: { type: 'boolean', operation: 'equals' },
          },
        ],
        combinator: 'and',
      },
    },
  },
});

const prepareFallbackCandidate = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Prepare fallback candidate',
    executeOnce: true,
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          {
            id: 'story-title',
            name: 'story_title',
            value:
              "={{ (() => { const ingest = $('Prefetch debatten').first().json; const idx = ($('Prepare insert').first().json.candidate_index ?? 0) + 1; const picked = (ingest.candidates || [])[idx]; return String(picked?.story_title || '').slice(0, 160); })() }}",
            type: 'string',
          },
          {
            id: 'why',
            name: 'why_interesting',
            value:
              "={{ (() => { const ingest = $('Prefetch debatten').first().json; const idx = ($('Prepare insert').first().json.candidate_index ?? 0) + 1; const picked = (ingest.candidates || [])[idx]; return 'Fallback politisk sak: ' + (picked?.story_title || ''); })() }}",
            type: 'string',
          },
          {
            id: 'tags',
            name: 'topic_tags',
            value: "={{ ['politikk'] }}",
            type: 'array',
          },
          {
            id: 'story-key',
            name: 'story_key',
            value:
              "={{ (() => { const ingest = $('Prefetch debatten').first().json; const idx = ($('Prepare insert').first().json.candidate_index ?? 0) + 1; return (ingest.candidates || [])[idx]?.story_key || ''; })() }}",
            type: 'string',
          },
          {
            id: 'politics-score',
            name: 'politics_score',
            value:
              "={{ (() => { const ingest = $('Prefetch debatten').first().json; const idx = ($('Prepare insert').first().json.candidate_index ?? 0) + 1; return (ingest.candidates || [])[idx]?.politics_score || 0; })() }}",
            type: 'number',
          },
          {
            id: 'candidate-index',
            name: 'candidate_index',
            value:
              "={{ (() => { return ($('Prepare insert').first().json.candidate_index ?? 0) + 1; })() }}",
            type: 'number',
          },
          {
            id: 'scout-meta',
            name: 'scout_metadata',
            value:
              "={{ (() => { const ingest = $('Prefetch debatten').first().json; const idx = ($('Prepare insert').first().json.candidate_index ?? 0) + 1; const picked = (ingest.candidates || [])[idx] || {}; const deb = (ingest.debatten_prefetch || [])[idx]; return { outlet_count: picked.outlet_count, outlets: picked.outlets, cluster_score: picked.cluster_score, ingest_stats: ingest.stats, debatten_used: !!deb, debatten_prefetched: !!deb, selected_index: idx, fallback: true, fetch_statuses: (picked.articles || []).map(() => 'pending') }; })() }}",
            type: 'object',
          },
          {
            id: 'articles',
            name: 'articles',
            value:
              "={{ (() => { const ingest = $('Prefetch debatten').first().json; const idx = ($('Prepare insert').first().json.candidate_index ?? 0) + 1; const picked = (ingest.candidates || [])[idx]; let articles = Array.isArray(picked?.articles) ? [...picked.articles] : []; const deb = (ingest.debatten_prefetch || [])[idx]; if (deb?.url && !articles.some((a) => a.url === deb.url)) articles.push(deb); return articles.slice(0, 6); })() }}",
            type: 'array',
          },
        ],
      },
    },
  },
});

const hasFallbackCandidate = ifElse({
  version: 2.2,
  config: {
    name: 'Has fallback candidate?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            leftValue:
              "={{ (() => { const curIdx = $('Prepare insert').first().json.candidate_index ?? 0; if (curIdx >= 1) return false; const ingest = $('Prefetch debatten').first().json; const idx = curIdx + 1; const picked = (ingest.candidates || [])[idx]; return !!(picked && picked.story_key && String($('Prepare fallback candidate').first().json.story_title || '').trim().length >= 15 && (picked.articles || []).length >= 2); })() }}",
            rightValue: true,
            operator: { type: 'boolean', operation: 'equals' },
          },
        ],
        combinator: 'and',
      },
    },
  },
});

sticky(
  '## Forum story scout v11.1\\n\\nDedup kun ved insert. Ingest uten DB-filter.\\nDebatten prefetch + agent. Transaksjonell insert. Cron */30.',
  [scheduleTrigger, webhookTrigger],
  { color: 4 }
);

const enrichChain = enrichArticles.to(updateScoutMetadata);

const insertPipeline = buildInsertQuery.to(insertClusterTransaction);

const secondCandidateBranch = hasSecondCandidate.onTrue(
  prepareSecondCandidate.to(enrichChain),
);

const savePipeline = checkDuplicateStory
  .to(prepareInsert)
  .to(
    notDuplicate
      .onTrue(insertPipeline.to(secondCandidateBranch))
      .onFalse(
        prepareFallbackCandidate.to(hasFallbackCandidate.onTrue(enrichChain)),
      ),
  );

const postEnrichPipeline = enrichChain.to(passesQualityGate.onTrue(savePipeline));

const pickPipeline = storyScoutAgent.to(normalizePick).to(postEnrichPipeline);

const scoutPipeline = buildPickPrompt.to(pickPipeline);

const discoveryPipeline = fetchDiscoveryContext
  .to(ingestAndCluster)
  .to(prefetchDebatten)
  .to(hasCandidates.onTrue(scoutPipeline).onFalse(logEmptyIngest));

export default workflow(
  'folkets-forum-research-discovery',
  'Folkets Stemme – Forum story scout (v11.1)'
)
  .add(scheduleTrigger)
  .to(discoveryPipeline)
  .add(webhookTrigger)
  .to(discoveryPipeline);
