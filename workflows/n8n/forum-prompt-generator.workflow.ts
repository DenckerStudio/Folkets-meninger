/**
 * Folkets Stemme – Forum JA/NEI prompt generator (v12)
 * Fetch pending cluster → én Ollama-agent → transactional save (draft).
 *
 * Webhook: POST folkets-forum-prompt-generator
 */
import {
  workflow,
  node,
  trigger,
  sticky,
  newCredential,
  languageModel,
  outputParser,
  expr,
} from '@n8n/workflow-sdk';
import {
  PROMPT_GENERATOR_SYSTEM,
  FETCH_CLUSTER_FOR_PROMPT_SQL,
  PROMPT_GENERATOR_SAVE_JS,
  MARK_CLUSTER_FAILED_PENDING_SQL,
} from './forum-workflow.shared';

const CLUSTER_ID_REPLACEMENT =
  "={{ (() => { const raw = $json.body?.clusterId ?? $json.body?.cluster_id ?? $json.query?.clusterId ?? $json.clusterId ?? $json.cluster_id ?? $json.id ?? ''; const id = String(raw || '').trim(); if (!id || id === 'null' || id === 'undefined') return ''; return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : ''; })() }}";

const promptAgentOllamaModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Prompt Ollama Chat Model',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'llama3.1:8b',
      options: { think: false, temperature: 0.15, numPredict: 1800, numCtx: 12288 },
    },
  },
});

const promptParserOllamaModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Prompt parser Ollama',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'llama3.2:3b-text-q4_K_M',
      options: { think: false, temperature: 0, format: 'json', numPredict: 1400, numCtx: 8192 },
    },
  },
});

const promptOutputParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Prompt JSON parser',
    onError: 'continueRegularOutput',
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample:
        '{"research":{"story_title":"Sak","summary":"…","political_choice":"…","confidence":"high"},"prompt":{"question":"Mener du …?","novelty_explanation":"…","source_indices":[0],"topic_tags":["politikk"],"sensitivity":"low","repeat_reason":null}}',
      autoFix: true,
    },
    subnodes: { model: promptParserOllamaModel },
  },
});

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.2,
  config: {
    name: 'Every 15 minutes',
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '*/15 * * * *' }] },
    },
  },
});

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook prompt generator',
    parameters: {
      path: 'folkets-forum-prompt-generator',
      httpMethod: 'POST',
      responseMode: 'onReceived',
    },
  },
  output: [{ body: { clusterId: 'uuid' } }],
});

const fetchClusterForPrompt = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch cluster for prompt',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query: FETCH_CLUSTER_FOR_PROMPT_SQL,
      options: { queryReplacement: CLUSTER_ID_REPLACEMENT },
    },
  },
  output: [
    {
      cluster_id: 'uuid',
      story_title: 'Sak',
      sources_block: '[0] Tittel (Regjeringen)',
      source_headlines: [{ title: 'T', url: 'https://regjeringen.no/1', outlet: 'Regjeringen' }],
      existing_questions: [],
      max_sort_order: 0,
    },
  ],
});

const buildPromptText = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Build prompt text',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          {
            id: 'prompt-text',
            name: 'promptText',
            value:
              "={{ (() => { const s = $('Fetch cluster for prompt').first().json; const ex = (s.existing_questions || []).slice(0, 35).map((q) => '- ' + q).join('\\n'); return 'SAK: ' + (s.story_title || '') + '\\n\\nKILDER:\\n' + (s.sources_block || '') + '\\n\\nEXISTING_PROMPTS (unngå duplikat):\\n' + (ex || '(ingen)') + '\\n\\nReturner research + ett JA/NEI-spørsmål som JSON.'; })() }}",
            type: 'string',
          },
        ],
      },
    },
  },
  output: [{ promptText: 'SAK: ...' }],
});

const promptGeneratorAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Prompt generator (Ollama)',
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.promptText }}'),
      hasOutputParser: true,
      options: {
        systemMessage: PROMPT_GENERATOR_SYSTEM,
        maxIterations: 2,
        returnIntermediateSteps: false,
        enableStreaming: false,
      },
      subnodes: {
        model: promptAgentOllamaModel,
        outputParser: promptOutputParser,
      },
    },
  },
  output: [
    {
      output: {
        research: { story_title: 'Sak', summary: '…', confidence: 'high' },
        prompt: { question: 'Mener du …?', source_indices: [0], sensitivity: 'low' },
      },
    },
  ],
});

const buildSaveQuery = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build save query',
    executeOnce: true,
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: PROMPT_GENERATOR_SAVE_JS,
    },
  },
});

const savePrompt = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save prompt',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query: '={{ $json.query }}',
    },
  },
  output: [{ id: 'uuid-prompt', question: 'Mener du …?' }],
});

const markClusterFailed = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Mark cluster failed',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query: MARK_CLUSTER_FAILED_PENDING_SQL,
      options: {
        queryReplacement: "={{ $('Fetch cluster for prompt').first().json.cluster_id }}",
      },
    },
  },
  output: [{ id: 'uuid' }],
});

sticky(
  '## Forum prompt generator v12\\n\\nFetch pending → én Ollama-agent → lagre utkast. Cron */15. Ingen processing-status.',
  [scheduleTrigger, webhookTrigger],
  { color: 5 }
);

const promptPipeline = fetchClusterForPrompt
  .to(buildPromptText)
  .to(promptGeneratorAgent.onError(markClusterFailed))
  .to(buildSaveQuery.to(savePrompt));

export default workflow(
  'folkets-forum-prompt-generator',
  'Folkets Stemme – Forum JA/NEI prompt generator (v12)'
)
  .add(scheduleTrigger)
  .to(promptPipeline)
  .add(webhookTrigger)
  .to(promptPipeline);
