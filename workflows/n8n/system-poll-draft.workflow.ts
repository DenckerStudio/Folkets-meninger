/**
 * Folkets Stemme – system poll (Reels) draft generator from Stortinget-sak RAG.
 *
 * Webhook: POST folkets-system-poll-draft
 */
import {
  workflow,
  node,
  trigger,
  sticky,
  newCredential,
  languageModel,
  expr,
  placeholder,
} from '@n8n/workflow-sdk';
import {
  FETCH_SAK_FOR_POLL_SQL,
  RAG_RETRIEVE_SQL,
  BUILD_RAG_QUERY_JS,
  MAP_EMBEDDING_FOR_RAG_JS,
  MERGE_RAG_CONTEXT_JS,
  SYSTEM_POLL_GENERATOR_SYSTEM,
  SYSTEM_POLL_GENERATOR_SAVE_JS,
} from './system-poll-draft.shared';

const ISSUE_ID_REPLACEMENT =
  "={{ [ (() => { const raw = $json.body?.stortinget_issue_id ?? $json.body?.stortingetIssueId ?? $json.body?.issue_id ?? $json.body?.id ?? $json.stortinget_issue_id ?? $json.issue_id ?? $json.id ?? ''; const id = String(raw || '').trim(); return id && id !== 'null' && id !== 'undefined' ? id : ''; })() ] }}";

const sakAgentOllamaModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'System poll Ollama Chat Model',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'gemma4:e2b-it-qat',
      options: { think: false, temperature: 0.15, numPredict: 1800, numCtx: 12288 },
    },
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
    name: 'Webhook system poll draft',
    parameters: {
      path: 'folkets-system-poll-draft',
      httpMethod: 'POST',
      responseMode: 'onReceived',
    },
  },
  output: [{ body: { stortinget_issue_id: '200329' } }],
});

const fetchSakForPoll = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch sak for poll',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query: FETCH_SAK_FOR_POLL_SQL,
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
        '{"model":"nomic-embed-text:v1.5","prompt":{{ JSON.stringify($json.ragQuery) }}}',
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
        queryReplacement: '={{ [ $json.issue_id, $json.vectorLiteral, $json.matchCount || 8 ] }}',
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

const systemPollGeneratorAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'System poll generator (Ollama)',
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.promptText }}'),
      hasOutputParser: false,
      options: {
        systemMessage: SYSTEM_POLL_GENERATOR_SYSTEM,
        maxIterations: 2,
        returnIntermediateSteps: false,
        enableStreaming: false,
      },
      subnodes: {
        model: sakAgentOllamaModel,
      },
    },
  },
  output: [
    {
      output: {
        research: { story_title: 'Sak', summary: '…', confidence: 'high' },
        prompt: { question: 'Mener du …?', source_indices: [0] },
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
      jsCode: SYSTEM_POLL_GENERATOR_SAVE_JS,
    },
  },
});

const saveDraft = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save system poll draft',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query: '={{ $json.query || "SELECT 1 AS skipped WHERE false" }}',
    },
  },
  output: [{ id: 'uuid-poll' }],
});

sticky(
  '## System poll (Reels) draft generator\\n\\nHent stortingssak med embeddings → RAG → Ollama ja/nei/blank → polls draft (track=system). Cron daglig 06:00. Webhook: folkets-system-poll-draft. Admin publiserer i appen.',
  [scheduleTrigger, webhookTrigger],
  { color: 4 },
);

const sakPipeline = fetchSakForPoll
  .to(buildRagQuery)
  .to(embedRagQuery)
  .to(mapEmbeddingForRag)
  .to(retrieveRagChunks)
  .to(mergeRagContext)
  .to(systemPollGeneratorAgent)
  .to(buildSaveQuery.to(saveDraft));

export default workflow(
  'folkets-system-poll-draft',
  'Folkets Stemme – system poll (Reels) draft from sak RAG',
)
  .add(scheduleTrigger)
  .to(sakPipeline)
  .add(webhookTrigger)
  .to(sakPipeline);
