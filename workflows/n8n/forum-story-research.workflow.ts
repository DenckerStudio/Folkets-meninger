/**
 * @deprecated v12 — use forum-prompt-generator.workflow.ts
 * Folkets Stemme – Forum story research + journalist (v10.2)
 * DB-kø: schedule henter status=accepted, webhook for manuell replay.
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
import {
  RESEARCH_JOURNALIST_SYSTEM,
  EXISTING_PROMPTS_FOR_EDITOR_SQL,
  CLAIM_NEXT_ACCEPTED_CLUSTER_SQL,
  FETCH_STORY_FOR_RESEARCH_SQL,
} from './forum-workflow.shared';

const CLUSTER_ID_EXPR =
  "={{ (() => { const raw = $json.body?.clusterId ?? $json.body?.cluster_id ?? $json.query?.clusterId ?? $json.clusterId ?? $json.cluster_id ?? ''; const id = String(raw || '').trim(); if (!id || id === 'null' || id === 'undefined') return ''; return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : ''; })() }}";

const researchAgentOllamaModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Research Ollama Chat Model',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'llama3.1:8b',
      // Ikke format:json her – det blokkerer tool-kall (SearXNG) i agent-loopen.
      options: { think: false, temperature: 0.15, numPredict: 2400, numCtx: 16384 },
    },
  },
});

const researchParserOllamaModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Research parser Ollama',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'llama3.2:3b-text-q4_K_M',
      options: { think: false, temperature: 0, format: 'json', numPredict: 1400, numCtx: 8192 },
    },
  },
});

const researchOutputParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Research JSON parser',
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample:
        '{"research":{"story_title":"Sak","summary":"…","shared_facts":["…"],"disagreements":[],"political_choice":"…","poll_angles":["…"],"confidence":"high"},"prompt":{"question":"Mener du …?","novelty_explanation":"…","source_indices":[0,1,2],"topic_tags":["politikk"],"sensitivity":"low","repeat_reason":null}}',
      autoFix: true,
    },
    subnodes: { model: researchParserOllamaModel },
  },
});

const searxngResearchTool = tool({
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
  version: 1.2,
  config: {
    name: 'Every 5 minutes',
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '*/5 * * * *' }] },
    },
  },
});

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook journalist',
    parameters: {
      path: 'folkets-forum-research-journalist',
      httpMethod: 'POST',
      responseMode: 'onReceived',
    },
  },
  output: [{ body: { clusterId: 'uuid' } }],
});

const claimNextCluster = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Claim next cluster',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: { operation: 'executeQuery', query: CLAIM_NEXT_ACCEPTED_CLUSTER_SQL },
  },
  output: [{ id: 'uuid', title: 'Eksempel sak' }],
});

const hasClaimedCluster = ifElse({
  version: 2.2,
  config: {
    name: 'Claimed cluster?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            leftValue: '={{ $json.id }}',
            rightValue: '',
            operator: { type: 'string', operation: 'notEmpty' },
          },
        ],
        combinator: 'and',
      },
    },
  },
});

const setClusterIdFromWebhook = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Set cluster id from webhook',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          {
            id: 'cluster-id',
            name: 'clusterId',
            value: CLUSTER_ID_EXPR,
            type: 'string',
          },
        ],
      },
    },
  },
  output: [{ clusterId: 'uuid' }],
});

const resolveClusterId = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Resolve cluster id',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          {
            id: 'cluster-id',
            name: 'clusterId',
            value:
              "={{ $json.clusterId || $json.id || $('Set cluster id from webhook').first().json.clusterId }}",
            type: 'string',
          },
        ],
      },
    },
  },
  output: [{ clusterId: 'uuid' }],
});

const hasValidClusterId = ifElse({
  version: 2.2,
  config: {
    name: 'Valid cluster id?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            leftValue: "={{ $('Set cluster id from webhook').first().json.clusterId }}",
            rightValue: '',
            operator: { type: 'string', operation: 'notEmpty' },
          },
        ],
        combinator: 'and',
      },
    },
  },
});

const markClusterProcessing = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Mark cluster processing',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query:
        "={{ \"UPDATE public.forum_research_clusters SET status = 'processing', updated_at = now() WHERE id = '\" + $('Set cluster id from webhook').first().json.clusterId + \"'::uuid AND status IN ('accepted','pending') RETURNING id, title\" }}",
    },
  },
  output: [{ id: 'uuid', title: 'Eksempel sak' }],
});

const clusterApproved = ifElse({
  version: 2.2,
  config: {
    name: 'Cluster approved?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            leftValue: '={{ $json.id }}',
            rightValue: '',
            operator: { type: 'string', operation: 'notEmpty' },
          },
        ],
        combinator: 'and',
      },
    },
  },
});

const fetchStorySources = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch story sources',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query: FETCH_STORY_FOR_RESEARCH_SQL,
      options: {
        queryReplacement: "={{ $('Resolve cluster id').first().json.clusterId }}",
      },
    },
  },
  output: [{ cluster_id: 'uuid', story_title: 'Sak', sources_block: '[0] Tittel (NRK)' }],
});

const fetchExistingPrompts = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch existing prompts',
    executeOnce: true,
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: { operation: 'executeQuery', query: EXISTING_PROMPTS_FOR_EDITOR_SQL },
  },
  output: [{ existing_questions: [], max_sort_order: 0 }],
});

const buildResearchPrompt = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Build research prompt',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          {
            id: 'research-text',
            name: 'researchText',
            value:
              "={{ (() => { const s = $('Fetch story sources').first().json; const ex = ($('Fetch existing prompts').first().json.existing_questions || []).slice(0,35).map((q) => '- ' + q).join('\\n'); return 'SAK: ' + (s.story_title || '') + '\\n\\nKILDER:\\n' + (s.sources_block || '') + '\\n\\nEXISTING_PROMPTS (unngå duplikat):\\n' + (ex || '(ingen)') + '\\n\\nReturner research + ett prompt som JSON.'; })() }}",
            type: 'string',
          },
        ],
      },
    },
  },
  output: [{ researchText: 'SAK: ...' }],
});

const researchJournalistAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Research journalist (Ollama)',
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.researchText }}'),
      hasOutputParser: true,
      options: {
        systemMessage: RESEARCH_JOURNALIST_SYSTEM,
        maxIterations: 5,
        returnIntermediateSteps: false,
        enableStreaming: false,
      },
      subnodes: {
        model: researchAgentOllamaModel,
        outputParser: researchOutputParser,
        tools: [searxngResearchTool],
      },
    },
  },
  output: [
    {
      output: {
        research: { story_title: 'Sak', summary: '…', confidence: 'high' },
        prompt: { question: 'Mener du …?', source_indices: [0, 1, 2], sensitivity: 'low' },
      },
    },
  ],
});

const saveDeepResearch = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save deep research',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query:
        "={{ \"UPDATE public.forum_research_clusters SET deep_research_json = '\" + JSON.stringify($json.output.research).replace(/'/g, \"''\") + \"'::jsonb, updated_at = now() WHERE id = '\" + $('Resolve cluster id').first().json.clusterId + \"'::uuid RETURNING id\" }}",
    },
  },
  output: [{ id: 'uuid' }],
});

const hasValidSynthesis = ifElse({
  version: 2.2,
  config: {
    name: 'Valid synthesis?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            leftValue:
              "={{ (() => { const out = $('Research journalist (Ollama)').first().json.output || {}; const q = String(out.prompt?.question || '').trim(); const sources = String($('Fetch story sources').first().json.sources_block || '').trim(); const hasSources = sources && sources !== '(ingen)'; const pc = String(out.research?.political_choice || '').trim(); const hasPolitics = pc && !/^ingen politisk valg$/i.test(pc); return q.length >= 15 && hasSources && hasPolitics; })() }}",
            rightValue: true,
            operator: { type: 'boolean', operation: 'equals' },
          },
        ],
        combinator: 'and',
      },
    },
  },
});

const markClusterFailed = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Mark cluster failed',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query:
        "={{ \"UPDATE public.forum_research_clusters SET status = 'failed', updated_at = now() WHERE id = '\" + $('Resolve cluster id').first().json.clusterId + \"'::uuid AND status = 'processing' RETURNING id\" }}",
    },
  },
  output: [{ id: 'uuid' }],
});

const prepareEditorHandoff = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Prepare editor handoff',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          {
            id: 'cluster-id',
            name: 'clusterId',
            value: "={{ $('Resolve cluster id').first().json.clusterId }}",
            type: 'string',
          },
          {
            id: 'research',
            name: 'research',
            value: '={{ $("Research journalist (Ollama)").first().json.output.research }}',
            type: 'object',
          },
          {
            id: 'candidate',
            name: 'candidate',
            value: '={{ $("Research journalist (Ollama)").first().json.output.prompt }}',
            type: 'object',
          },
          {
            id: 'sources-block',
            name: 'sources_block',
            value: "={{ $('Fetch story sources').first().json.sources_block }}",
            type: 'string',
          },
        ],
      },
    },
  },
  output: [{ clusterId: 'uuid', candidate: { question: 'Mener du …?' } }],
});

const triggerEditorWorkflow = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Trigger editor workflow',
    parameters: {
      source: 'database',
      workflowId: {
        __rl: true,
        mode: 'id',
        value: 'YY6u4GmeiZVk5R2e',
        cachedResultName: 'Folkets Stemme – Forum story editor (v10)',
      },
      mode: 'once',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          clusterId: "={{ $json.clusterId }}",
          candidate: '={{ $json.candidate }}',
          sources_block: '={{ $json.sources_block }}',
          research: '={{ $json.research }}',
        },
      },
      options: { waitForSubWorkflow: true },
    },
  },
  output: [{ success: true }],
});

sticky(
  '## Forum research + journalist v10.2\\n\\nSchedule: claim status=accepted fra DB. Webhook: manuell replay med clusterId. Ingen app-webhook ved godkjenning.',
  [scheduleTrigger, webhookTrigger],
  { color: 5 }
);

const editorHandoff = prepareEditorHandoff.to(triggerEditorWorkflow);

const researchBody = resolveClusterId
  .to(fetchStorySources)
  .to(fetchExistingPrompts)
  .to(buildResearchPrompt)
  .to(researchJournalistAgent)
  .to(
    hasValidSynthesis
      .onTrue(saveDeepResearch.to(editorHandoff))
      .onFalse(markClusterFailed)
  );

const schedulePipeline = claimNextCluster.to(
  hasClaimedCluster.onTrue(researchBody)
);

const webhookPipeline = setClusterIdFromWebhook
  .to(hasValidClusterId.onTrue(markClusterProcessing.to(clusterApproved.onTrue(researchBody))));

export default workflow(
  'folkets-forum-research-journalist',
  'Folkets Stemme – Forum story research (v10.2)'
)
  .add(scheduleTrigger)
  .to(schedulePipeline)
  .add(webhookTrigger)
  .to(webhookPipeline);
