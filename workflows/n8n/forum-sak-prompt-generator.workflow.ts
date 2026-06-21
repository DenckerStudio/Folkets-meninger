/**
 * Folkets Stemme – Forum Stortinget-sak RAG prompt generator (v13)
 * Fetch sak + RAG chunks → Ollama JA/NEI → forum_prompts draft.
 *
 * Webhook: POST folkets-forum-sak-prompt-generator
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
  placeholder,
} from '@n8n/workflow-sdk';
import {
  FETCH_SAK_FOR_PROMPT_SQL,
  RAG_RETRIEVE_SQL,
  BUILD_RAG_QUERY_JS,
  MAP_EMBEDDING_FOR_RAG_JS,
  MERGE_RAG_CONTEXT_JS,
  SAK_PROMPT_GENERATOR_SYSTEM,
  SAK_PROMPT_GENERATOR_SAVE_JS,
} from './forum-sak-prompt.shared';

const ISSUE_ID_REPLACEMENT =
  "={{ (() => { const raw = $json.body?.stortinget_issue_id ?? $json.body?.stortingetIssueId ?? $json.body?.issue_id ?? $json.body?.id ?? $json.stortinget_issue_id ?? $json.issue_id ?? $json.id ?? ''; const id = String(raw || '').trim(); return id && id !== 'null' && id !== 'undefined' ? id : ''; })() }}";

const sakAgentOllamaModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Sak prompt Ollama Chat Model',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'llama3.1:8b',
      options: { think: false, temperature: 0.15, numPredict: 1800, numCtx: 12288 },
    },
  },
});

const sakParserOllamaModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Sak prompt parser Ollama',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'llama3.2:3b-text-q4_K_M',
      options: { think: false, temperature: 0, format: 'json', numPredict: 1400, numCtx: 8192 },
    },
  },
});

const sakOutputParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Sak prompt JSON parser',
    onError: 'continueRegularOutput',
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample:
        '{"research":{"story_title":"Sak","summary":"…","political_choice":"…","confidence":"high"},"prompt":{"question":"Mener du …?","novelty_explanation":"…","source_indices":[0],"topic_tags":["stortingssak"],"sensitivity":"low","repeat_reason":null}}',
      autoFix: true,
    },
    subnodes: { model: sakParserOllamaModel },
  },
});

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.2,
  config: {
    name: 'Daily 06:00',
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '0 6 * * *' }] },
    },
  },
});

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook sak prompt generator',
    parameters: {
      path: 'folkets-forum-sak-prompt-generator',
      httpMethod: 'POST',
      responseMode: 'onReceived',
    },
  },
  output: [{ body: { stortinget_issue_id: '200329' } }],
});

const fetchSakForPrompt = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch sak for prompt',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query: FETCH_SAK_FOR_PROMPT_SQL,
      options: { queryReplacement: ISSUE_ID_REPLACEMENT },
    },
  },
  output: [
    {
      issue_id: '200329',
      issue_title: 'Eksempel stortingssak',
      issue_summary: 'Sammendrag',
      detail_excerpt: 'Innstillingstekst utdrag',
      existing_questions: [],
      max_sort_order: 0,
      documents: [],
    },
  ],
});

const buildRagQuery = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build RAG query',
    executeOnce: true,
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: BUILD_RAG_QUERY_JS,
    },
  },
});

const embedRagQuery = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Ollama embeddings',
    onError: 'continueErrorOutput',
    parameters: {
      method: 'POST',
      url: placeholder('https://ollama.example.com/api/embeddings'),
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '{"model":"nomic-embed-text:v1.5","prompt":{{ JSON.stringify($json.ragQuery) }}}'
      ),
      options: { timeout: 120000 },
    },
  },
  output: [{ embedding: [0.1, 0.2, 0.3] }],
});

const mapEmbeddingForRag = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Map embedding for RAG',
    executeOnce: true,
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: MAP_EMBEDDING_FOR_RAG_JS,
    },
  },
});

const retrieveRagChunks = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Retrieve RAG chunks',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query: RAG_RETRIEVE_SQL,
      options: {
        queryReplacement:
          "={{ [ $json.issue_id, $json.vectorLiteral, $json.matchCount || 8 ] }}",
      },
    },
  },
  output: [
    {
      document_id: 'inns-202526-434s',
      chunk_index: 0,
      content: 'Eksempel RAG chunk',
      similarity: 0.82,
    },
  ],
});

const mergeRagContext = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Merge RAG context',
    executeOnce: true,
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: MERGE_RAG_CONTEXT_JS,
    },
  },
});

const sakPromptGeneratorAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Sak prompt generator (Ollama)',
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.promptText }}'),
      hasOutputParser: true,
      options: {
        systemMessage: SAK_PROMPT_GENERATOR_SYSTEM,
        maxIterations: 2,
        returnIntermediateSteps: false,
        enableStreaming: false,
      },
      subnodes: {
        model: sakAgentOllamaModel,
        outputParser: sakOutputParser,
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
      jsCode: SAK_PROMPT_GENERATOR_SAVE_JS,
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
  output: [{ id: 'uuid-prompt', question: 'Mener du …?', stortinget_issue_id: '200329' }],
});

sticky(
  '## Forum sak-RAG prompt generator v13\\n\\nHent stortingssak med embeddings → RAG → Ollama JA/NEI → draft. Cron daglig 06:00. Webhook: folkets-forum-sak-prompt-generator',
  [scheduleTrigger, webhookTrigger],
  { color: 4 }
);

const sakPipeline = fetchSakForPrompt
  .to(buildRagQuery)
  .to(embedRagQuery)
  .to(mapEmbeddingForRag)
  .to(retrieveRagChunks)
  .to(mergeRagContext)
  .to(sakPromptGeneratorAgent)
  .to(buildSaveQuery.to(savePrompt));

export default workflow(
  'folkets-forum-sak-prompt-generator',
  'Folkets Stemme – Forum Stortinget-sak RAG prompt generator (v13)'
)
  .add(scheduleTrigger)
  .to(sakPipeline)
  .add(webhookTrigger)
  .to(sakPipeline);
