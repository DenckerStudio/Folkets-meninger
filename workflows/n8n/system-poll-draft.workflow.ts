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
  ifElse,
  expr,
} from '@n8n/workflow-sdk';
import { FOLKETS_SUPABASE_CRED, FOLKETS_SUPABASE_REST } from './n8n-supabase.shared';
import {
  BUILD_RAG_QUERY_JS,
  MAP_EMBEDDING_FOR_RAG_JS,
  MERGE_RAG_CONTEXT_JS,
  SYSTEM_POLL_GENERATOR_SYSTEM,
  SYSTEM_POLL_GENERATOR_SAVE_JS,
} from './system-poll-draft.shared';

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
  version: 1.3,
  config: {
    name: 'Daily 06:00',
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '0 6 * * *' }] },
    },
  },
  output: [{}],
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

const normalizePollInput = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Normalize poll input',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          {
            id: 'issue-id',
            name: 'issueId',
            type: 'string',
            value: expr(
              "{{ $json.body?.stortinget_issue_id ?? $json.body?.stortingetIssueId ?? $json.body?.issue_id ?? $json.body?.id ?? $json.stortinget_issue_id ?? $json.issue_id ?? $json.id ?? '' }}",
            ),
          },
        ],
      },
    },
  },
  output: [{ issueId: '200329' }],
});

const fetchSakForPoll = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Fetch sak for poll',
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 2000,
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      method: 'POST',
      url: `${FOLKETS_SUPABASE_REST}/rpc/n8n_list_sak_for_system_poll`,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '={{ JSON.stringify({ p_issue_id: $json.issueId || null }) }}',
      ),
      options: { timeout: 60000 },
    },
  },
  output: [
    {
      issue_id: '200329',
      issue_title: 'Eksempel stortingssak',
      issue_summary: 'Sammendrag',
      henvisning: 'Prop. 1 L',
      sak_kind: 'lovforslag',
      komite: 'Justiskomiteen',
      detail_excerpt: 'Innstillingstekst utdrag',
      ai_hva: 'Kort AI-sammendrag',
      fallback_chunks: [],
      existing_questions: [],
      documents: [],
      source_kind: 'rag',
    },
  ],
});

const expandSakForPoll = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Expand sak for poll',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const raw = $input.first()?.json;
let rows = [];
if (Array.isArray(raw)) rows = raw;
else if (Array.isArray(raw?.data)) rows = raw.data;
else if (raw && typeof raw === 'object' && raw.issue_id) rows = [raw];
else {
  const all = $input.all().map((i) => i.json).filter(Boolean);
  if (all.length && all.every((r) => r && r.issue_id && !Array.isArray(r))) rows = all;
}
return rows.filter((r) => r && r.issue_id).map((r) => ({ json: r }));`,
    },
  },
  output: [
    {
      issue_id: '200329',
      issue_title: 'Eksempel stortingssak',
      issue_summary: 'Sammendrag',
      henvisning: 'Prop. 1 L',
      sak_kind: 'lovforslag',
      source_kind: 'rag',
      fallback_chunks: [],
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
  output: [{ issue_id: '200329', ragQuery: 'Eksempel stortingssak' }],
});

const embedRagQuery = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Ollama embeddings',
    onError: 'continueRegularOutput',
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 3000,
    parameters: {
      method: 'POST',
      url: 'https://ollama.heyklever.app/api/embeddings',
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
  output: [{ issue_id: '200329', vectorLiteral: '[0.1,0.2]', matchCount: 8 }],
});

const retrieveRagChunks = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Retrieve RAG chunks',
    onError: 'continueRegularOutput',
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 2000,
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      method: 'POST',
      url: `${FOLKETS_SUPABASE_REST}/rpc/n8n_match_issue_document_chunks`,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '={{ JSON.stringify({ p_issue_id: $json.issue_id, p_query_embedding: $json.vectorLiteral, p_match_count: $json.matchCount || 8 }) }}',
      ),
      options: { timeout: 60000 },
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
  output: [{ promptText: 'STORTINGSSAK', issue_id: '200329', rag_chunks: [], source_urls: [] }],
});

const systemPollGeneratorAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'System poll generator (Ollama)',
    onError: 'continueRegularOutput',
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 4000,
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
  output: [{ rpcBody: { p_issue_id: '200329', p_title: 'Mener du ...?' }, outcome: 'saved' }],
});

const gateSaveDraft = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Gate save draft',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const item = $input.first()?.json || {};
if (!item.rpcBody) return [];
return [{ json: item }];`,
    },
  },
  output: [{ rpcBody: { p_issue_id: '200329', p_title: 'Mener du ...?' }, outcome: 'saved' }],
});

const saveDraft = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Save system poll draft',
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 2000,
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      method: 'POST',
      url: `${FOLKETS_SUPABASE_REST}/rpc/create_system_poll_draft`,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('={{ JSON.stringify($json.rpcBody || {}) }}'),
      options: { timeout: 60000 },
    },
  },
  output: [{ id: 'uuid-poll' }],
});

const hasEmbeddingVector = ifElse({
  version: 2.3,
  config: {
    name: 'Has embedding vector',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            leftValue: expr('{{ $json.vectorLiteral }}'),
            operator: { type: 'string', operation: 'notEmpty' },
          },
        ],
        combinator: 'and',
      },
    },
  },
});

const pipelineErrorTrigger = trigger({
  type: 'n8n-nodes-base.errorTrigger',
  version: 1,
  config: { name: 'Pipeline error' },
  output: [{ workflow: { name: 'folkets-system-poll-draft' }, execution: { id: '0' } }],
});

const recordPipelineError = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Record pipeline error',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          {
            id: 'fallback',
            name: 'appFallback',
            type: 'string',
            value: '/api/cron/n8n-retry re-queues draft webhook; pending sak stays without poll',
          },
          {
            id: 'at',
            name: 'failedAt',
            type: 'string',
            value: expr('{{ $now.toISO() }}'),
          },
        ],
      },
    },
  },
  output: [{ appFallback: '/api/cron/n8n-retry', failedAt: '2026-10-03T00:00:00.000Z' }],
});

sticky(
  '## System poll (Reels) draft generator\\n\\nHent pending sak (RAG, AI-sammendrag eller metadata) → Ollama ja/nei/blank → create_system_poll_draft. Embedding-feil faller tilbake til dokumentutdrag. Error Trigger logger; appen re-trigges via /api/cron/n8n-retry. ALDRI ensure_stortinget_poll.',
  [scheduleTrigger, webhookTrigger, pipelineErrorTrigger],
  { color: 4 },
);

const sakPipeline = normalizePollInput
  .to(fetchSakForPoll)
  .to(expandSakForPoll)
  .to(buildRagQuery)
  .to(embedRagQuery)
  .to(mapEmbeddingForRag)
  .to(
    hasEmbeddingVector
      .onTrue(retrieveRagChunks.to(mergeRagContext))
      .onFalse(mergeRagContext),
  )
  .to(systemPollGeneratorAgent)
  .to(buildSaveQuery.to(gateSaveDraft.to(saveDraft)));

export default workflow(
  'folkets-system-poll-draft',
  'Folkets Stemme – system poll (Reels) draft from sak RAG',
)
  .add(scheduleTrigger)
  .to(sakPipeline)
  .add(webhookTrigger)
  .to(sakPipeline)
  .add(pipelineErrorTrigger)
  .to(recordPipelineError);
