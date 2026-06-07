#!/usr/bin/env node
/** @deprecated Use scripts/deploy-forum-v12-prompt-generator.mjs (v10 journalist/editor are archived). */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const N8N_BASE = process.env.N8N_API_URL || 'https://n8n.heyklever.app';
const JOURNALIST_ID = 'sb31mc2dmhIvdbRg';
const EDITOR_ID = 'YY6u4GmeiZVk5R2e';

function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const envPath = path.join(root, name);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i < 0) continue;
      let v = line.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[line.slice(0, i).trim()]) process.env[line.slice(0, i).trim()] = v;
    }
  }
}

async function getWorkflow(id, headers) {
  const res = await fetch(`${N8N_BASE}/api/v1/workflows/${id}`, { headers });
  if (!res.ok) throw new Error(`GET ${id}: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.data ?? json;
}

function extractConst(bundled, name) {
  const re = new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`, 'm');
  const m = bundled.match(re);
  if (!m) throw new Error(`missing ${name}`);
  return m[1];
}

async function main() {
  loadEnv();
  const key = process.env.N8N_API_KEY;
  if (!key) throw new Error('N8N_API_KEY missing');
  const headers = { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' };

  spawnSync(process.execPath, [path.join(root, 'scripts/bundle-forum-prompt-generator-workflow.mjs'), path.join(root, '.tmp/forum-prompt-generator-bundled.ts')], { cwd: root });
  const bundled = fs.readFileSync(path.join(root, '.tmp/forum-prompt-generator-bundled.ts'), 'utf8');

  const [journalist, editor] = await Promise.all([
    getWorkflow(JOURNALIST_ID, headers),
    getWorkflow(EDITOR_ID, headers),
  ]);

  const credRes = await fetch(`${N8N_BASE}/api/v1/credentials`, { headers: { 'X-N8N-API-KEY': key } });
  const credJson = await credRes.json();
  const creds = credJson.data ?? credJson;
  const folk = creds.find((c) => c.name === 'Fokets Meninger');
  const ollama = creds.find((c) => c.name === 'Ollama account');

  const drop = new Set([
    'Prepare editor handoff',
    'Trigger editor workflow',
    'SearXNG',
    'Valid synthesis?',
  ]);

  const nodes = journalist.nodes.filter((n) => !drop.has(n.name)).map((n) => JSON.parse(JSON.stringify(n)));

  const editorPick = ['Prepare prompt insert', 'Insert forum prompt', 'Mark cluster draft'];
  for (const name of editorPick) {
    const src = editor.nodes.find((n) => n.name === name);
    if (src) nodes.push(JSON.parse(JSON.stringify(src)));
  }

  const enrichJs = extractConst(bundled, 'PROMPT_ENRICH_ARTICLE_JS');
  const enrichNode = {
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: enrichJs },
    id: 'enrich-article-excerpt-v12',
    name: 'Enrich article excerpt',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1200, 300],
    executeOnce: true,
  };
  const refetchNode = nodes.find((n) => n.name === 'Fetch story sources');
  const refetchCopy = refetchNode
    ? { ...JSON.parse(JSON.stringify(refetchNode)), id: 'refetch-story-sources-v12', name: 'Refetch story sources', position: [1500, 300] }
    : null;
  const applyEnrichNode = {
    parameters: { operation: 'executeQuery', query: '={{ $json.update_sql }}' },
    id: 'apply-enrich-update-v12',
    name: 'Apply enrich update',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.6,
    position: [1350, 200],
    credentials: folk ? { postgres: { id: folk.id, name: folk.name } } : undefined,
  };
  const hasEnrichNode = {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            id: 'enriched',
            leftValue: '={{ $json.enriched === true && !!$json.update_sql }}',
            rightValue: true,
            operator: { type: 'boolean', operation: 'equals' },
          },
        ],
        combinator: 'and',
      },
    },
    id: 'has-enrich-update-v12',
    name: 'Enrich update?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [1300, 300],
  };

  nodes.push(enrichNode, hasEnrichNode, applyEnrichNode);
  if (refetchCopy) nodes.push(refetchCopy);

  const headlinesNode = {
    parameters: {
      operation: 'executeQuery',
      query:
        "={{ \"SELECT COALESCE(json_agg(json_build_object('title', a.title, 'url', a.url, 'outlet', a.outlet) ORDER BY a.sort_order), '[]'::json) AS source_headlines FROM public.forum_research_articles a WHERE a.cluster_id = '\" + $('Resolve cluster id').first().json.clusterId + \"'::uuid\" }}",
    },
    id: 'fetch-article-headlines-v12',
    name: 'Fetch article headlines',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.6,
    position: [1800, 300],
    credentials: folk ? { postgres: { id: folk.id, name: folk.name } } : undefined,
  };
  nodes.push(headlinesNode);

  const clusterReadyNode = {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            id: 'ready',
            leftValue: '={{ $json.id }}',
            rightValue: '',
            operator: { type: 'string', operation: 'notEmpty' },
          },
        ],
        combinator: 'and',
      },
    },
    id: 'cluster-ready-v12',
    name: 'Cluster ready?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [900, 500],
  };
  nodes.push(clusterReadyNode);

  const validPromptNode = {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            id: 'valid',
            leftValue:
              "={{ (() => { const out = $('Prompt generator (Ollama)').first().json.output || {}; const q = String(out.prompt?.question || '').trim(); const sources = String(($('Refetch story sources').first().json.sources_block || $('Fetch story sources').first().json.sources_block) || '').trim(); const hasSources = sources && sources !== '(ingen)'; const pc = String(out.research?.political_choice || '').trim(); const hasPolitics = pc && !/^ingen politisk valg$/i.test(pc); return q.length >= 15 && hasSources && hasPolitics; })() }}",
            rightValue: true,
            operator: { type: 'boolean', operation: 'equals' },
          },
        ],
        combinator: 'and',
      },
    },
    id: 'valid-prompt-v12',
    name: 'Valid prompt?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [2100, 300],
  };
  nodes.push(validPromptNode);

  const systemMsg = extractConst(bundled, 'PROMPT_GENERATOR_SYSTEM');
  const sqlMap = {
    'Claim next cluster': extractConst(bundled, 'CLAIM_NEXT_PENDING_CLUSTER_SQL'),
    'Fetch story sources': extractConst(bundled, 'FETCH_STORY_FOR_RESEARCH_SQL'),
    'Refetch story sources': extractConst(bundled, 'FETCH_STORY_FOR_RESEARCH_SQL'),
    'Fetch existing prompts': extractConst(bundled, 'EXISTING_PROMPTS_FOR_EDITOR_SQL'),
  };

  for (const node of nodes) {
    if (folk && node.type === 'n8n-nodes-base.postgres') {
      node.credentials = { postgres: { id: folk.id, name: folk.name } };
    }
    if (ollama && node.type === '@n8n/n8n-nodes-langchain.lmChatOllama') {
      node.credentials = { ollamaApi: { id: ollama.id, name: ollama.name } };
    }
    if (sqlMap[node.name]) node.parameters.query = sqlMap[node.name];
    if (node.name === 'Fetch story sources' || node.name === 'Refetch story sources') {
      node.parameters.options = {
        queryReplacement:
          "={{ $('Claim next cluster').first().json.id || $('Resolve cluster id').first().json.clusterId }}",
      };
    }
    if (node.name === 'Research journalist (Ollama)') {
      node.name = 'Prompt generator (Ollama)';
      node.parameters.options.systemMessage = systemMsg;
      node.parameters.options.maxIterations = 2;
    }
    if (node.name === 'Build research prompt') {
      node.name = 'Build prompt text';
      node.parameters.assignments.assignments[0].name = 'promptText';
      node.parameters.assignments.assignments[0].value =
        "={{ (() => { const s = $('Refetch story sources').first().json.story_title ? $('Refetch story sources').first().json : $('Fetch story sources').first().json; const ex = ($('Fetch existing prompts').first().json.existing_questions || []).slice(0,35).map((q) => '- ' + q).join('\\n'); return 'SAK: ' + (s.story_title || '') + '\\n\\nKILDER:\\n' + (s.sources_block || '') + '\\n\\nEXISTING_PROMPTS (unngå duplikat):\\n' + (ex || '(ingen)') + '\\n\\nReturner research + ett JA/NEI-spørsmål som JSON.'; })() }}";
    }
    if (node.name === 'Webhook journalist') {
      node.name = 'Webhook prompt generator';
      node.parameters.path = 'folkets-forum-prompt-generator';
    }
    if (node.name === 'Every 5 minutes') {
      node.name = 'Every 15 minutes';
      node.parameters.rule.interval[0].expression = '*/15 * * * *';
    }
    if (node.name === 'Save deep research') {
      node.parameters.query =
        "={{ \"UPDATE public.forum_research_clusters SET deep_research_json = '\" + JSON.stringify($('Prompt generator (Ollama)').first().json.output.research).replace(/'/g, \"''\") + \"'::jsonb, updated_at = now() WHERE id = '\" + $('Resolve cluster id').first().json.clusterId + \"'::uuid RETURNING id\" }}";
    }
    if (node.name === 'Mark cluster draft') {
      node.parameters.query =
        "={{ \"UPDATE public.forum_research_clusters SET status = 'draft', processed_at = now(), updated_at = now() WHERE id = '\" + $('Resolve cluster id').first().json.clusterId + \"'::uuid RETURNING id\" }}";
    }
    if (node.name === 'Mark cluster failed') {
      node.parameters.query =
        "={{ \"UPDATE public.forum_research_clusters SET status = 'failed', updated_at = now() WHERE id = '\" + $('Resolve cluster id').first().json.clusterId + \"'::uuid AND status = 'processing' RETURNING id\" }}";
    }
    if (node.name === 'Prepare prompt insert') {
      const assigns = node.parameters.assignments.assignments;
      const q = assigns.find((a) => a.name === 'question');
      if (q) q.value = '={{ $("Prompt generator (Ollama)").first().json.output.prompt.question }}';
      const h = assigns.find((a) => a.name === 'source_headlines');
      if (h) h.value = "={{ $('Fetch article headlines').first().json.source_headlines }}";
      const c = assigns.find((a) => a.name === 'research_cluster_id');
      if (c) c.value = "={{ $('Resolve cluster id').first().json.clusterId }}";
    }
    if (node.name === 'Prompt generator (Ollama)' || node.name === 'Research journalist (Ollama)') {
      node.parameters.text = '={{ $json.promptText || $json.researchText }}';
    }
  }

  const connections = {
    'Every 15 minutes': { main: [[{ node: 'Claim next cluster', type: 'main', index: 0 }]] },
    'Webhook prompt generator': { main: [[{ node: 'Set cluster id from webhook', type: 'main', index: 0 }]] },
    'Claim next cluster': { main: [[{ node: 'Claimed cluster?', type: 'main', index: 0 }]] },
    'Claimed cluster?': { main: [[{ node: 'Fetch story sources', type: 'main', index: 0 }], []] },
    'Set cluster id from webhook': { main: [[{ node: 'Resolve cluster id', type: 'main', index: 0 }]] },
    'Resolve cluster id': { main: [[{ node: 'Valid cluster id?', type: 'main', index: 0 }]] },
    'Valid cluster id?': {
      main: [[{ node: 'Mark cluster processing', type: 'main', index: 0 }], []],
    },
    'Mark cluster processing': { main: [[{ node: 'Cluster ready?', type: 'main', index: 0 }]] },
    'Cluster ready?': { main: [[{ node: 'Fetch story sources', type: 'main', index: 0 }], []] },
    'Fetch story sources': { main: [[{ node: 'Enrich article excerpt', type: 'main', index: 0 }]] },
    'Enrich article excerpt': { main: [[{ node: 'Enrich update?', type: 'main', index: 0 }]] },
    'Enrich update?': {
      main: [
        [{ node: 'Apply enrich update', type: 'main', index: 0 }],
        [{ node: 'Refetch story sources', type: 'main', index: 0 }],
      ],
    },
    'Apply enrich update': { main: [[{ node: 'Refetch story sources', type: 'main', index: 0 }]] },
    'Refetch story sources': { main: [[{ node: 'Fetch existing prompts', type: 'main', index: 0 }]] },
    'Fetch existing prompts': { main: [[{ node: 'Fetch article headlines', type: 'main', index: 0 }]] },
    'Fetch article headlines': { main: [[{ node: 'Build prompt text', type: 'main', index: 0 }]] },
    'Build prompt text': { main: [[{ node: 'Prompt generator (Ollama)', type: 'main', index: 0 }]] },
    'Prompt generator (Ollama)': { main: [[{ node: 'Valid prompt?', type: 'main', index: 0 }]] },
    'Valid prompt?': {
      main: [
        [{ node: 'Save deep research', type: 'main', index: 0 }],
        [{ node: 'Mark cluster failed', type: 'main', index: 0 }],
      ],
    },
    'Save deep research': { main: [[{ node: 'Prepare prompt insert', type: 'main', index: 0 }]] },
    'Prepare prompt insert': { main: [[{ node: 'Insert forum prompt', type: 'main', index: 0 }]] },
    'Insert forum prompt': { main: [[{ node: 'Mark cluster draft', type: 'main', index: 0 }]] },
    'Research Ollama Chat Model': { ai_languageModel: [[{ node: 'Prompt generator (Ollama)', type: 'ai_languageModel', index: 0 }]] },
    'Research parser Ollama': { ai_languageModel: [[{ node: 'Research JSON parser', type: 'ai_languageModel', index: 0 }]] },
    'Research JSON parser': { ai_outputParser: [[{ node: 'Prompt generator (Ollama)', type: 'ai_outputParser', index: 0 }]] },
  };

  const createRes = await fetch(`${N8N_BASE}/api/v1/workflows`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Folkets Stemme – Forum JA/NEI prompt generator (v12)',
      nodes,
      connections,
      settings: { executionOrder: 'v1' },
    }),
  });
  if (!createRes.ok) throw new Error(`POST: ${createRes.status} ${await createRes.text()}`);
  const createdJson = await createRes.json();
  const workflowId = (createdJson.data ?? createdJson).id;

  const pub = await fetch(`${N8N_BASE}/api/v1/workflows/${workflowId}/activate`, {
    method: 'POST',
    headers: { 'X-N8N-API-KEY': key },
  });
  if (!pub.ok) throw new Error(`Activate: ${pub.status} ${await pub.text()}`);

  console.log(
    JSON.stringify({
      ok: true,
      workflowId,
      url: `${N8N_BASE}/workflow/${workflowId}`,
      nodeCount: nodes.length,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
