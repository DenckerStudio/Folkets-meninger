import {
  workflow,
  node,
  trigger,
  sticky,
  newCredential,
  expr,
  ifElse,
} from '@n8n/workflow-sdk';
import {
  FOLKETS_N8N_BASE,
  FOLKETS_OLLAMA_EMBEDDINGS_URL,
  FOLKETS_OLLAMA_EMBED_MODEL,
  FOLKETS_SUPABASE_CRED,
  rpcUrl,
} from './n8n-supabase.shared';
import { EXPAND_OR_EMPTY_JS } from './n8n-pipeline.shared';

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Every 60 minutes',
    parameters: {
      rule: {
        interval: [{ field: 'hours', hoursInterval: 1 }],
      },
    },
  },
  output: [{}],
});

const embeddingSettings = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Embedding settings',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'batch-limit', name: 'batchLimit', value: '8', type: 'string' },
          { id: 'issue-id', name: 'issueId', value: '', type: 'string' },
        ],
      },
    },
  },
  output: [{ batchLimit: '8', issueId: '' }],
});

const fetchPendingChunks = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Fetch pending chunks',
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'POST',
      url: rpcUrl('n8n_list_pending_document_chunks'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '={{ JSON.stringify({ p_issue_id: $json.issueId || null, p_limit: Number($json.batchLimit || 8) }) }}',
      ),
      options: { timeout: 60000 },
    },
  },
  output: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      issue_id: '200329',
      document_id: 'inns-202526-434s',
      chunk_index: 0,
      content: 'Eksempel chunk tekst',
    },
  ],
});

const expandPendingChunks = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Expand pending chunks',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: EXPAND_OR_EMPTY_JS,
    },
  },
  output: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      issue_id: '200329',
      document_id: 'inns-202526-434s',
      chunk_index: 0,
      content: 'Eksempel chunk tekst',
    },
  ],
});

const hasPendingChunk = ifElse({
  version: 2.2,
  config: {
    name: 'Has pending chunk?',
    parameters: {
      looseTypeValidation: true,
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'has-id',
            leftValue: expr('{{ $json.id }}'),
            rightValue: '',
            operator: { type: 'string', operation: 'notEmpty' },
          },
        ],
      },
    },
  },
});

const embedChunk = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Ollama embeddings',
    onError: 'continueErrorOutput',
    parameters: {
      method: 'POST',
      url: FOLKETS_OLLAMA_EMBEDDINGS_URL,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        `{"model":"${FOLKETS_OLLAMA_EMBED_MODEL}","prompt":{{ JSON.stringify($json.content) }}}`,
      ),
      options: { timeout: 120000 },
    },
  },
  output: [{ embedding: [0.1, 0.2, 0.3] }],
});

const mapEmbedding = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Map embedding vector',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `const chunk = $('Expand pending chunks').item.json;
const response = $input.item.json;
const embedding = response.embedding;
if (!Array.isArray(embedding) || embedding.length === 0) {
  return {
    json: {
      ...chunk,
      skip: true,
      outcome: 'embed_failed',
      reason: 'missing_embedding_vector',
      message: 'Ollama returned no embedding; chunk left pending for retry',
    },
  };
}
return { json: { ...chunk, embedding } };`,
    },
  },
  output: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      issue_id: '200329',
      document_id: 'inns-202526-434s',
      embedding: [0.1, 0.2, 0.3],
    },
  ],
});

const prepareEmbeddingUpdate = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare embedding update SQL',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `const item = $input.item.json;
if (item.skip || item.outcome === 'embed_failed' || item.outcome === 'empty_queue') {
  return { json: item };
}
const embedding = item.embedding;
if (!Array.isArray(embedding) || embedding.length === 0) {
  return {
    json: {
      ...item,
      skip: true,
      outcome: 'embed_failed',
      reason: 'missing_embedding_vector',
    },
  };
}
return {
  json: {
    ...item,
    embedding_vector: '[' + embedding.join(',') + ']',
  },
};`,
    },
  },
  output: [{ embedding_vector: '[0.1,0.2,0.3]' }],
});

const hasEmbeddingVector = ifElse({
  version: 2.2,
  config: {
    name: 'Has embedding vector?',
    parameters: {
      looseTypeValidation: true,
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'has-vec',
            leftValue: expr('{{ $json.embedding_vector }}'),
            rightValue: '',
            operator: { type: 'string', operation: 'notEmpty' },
          },
        ],
      },
    },
  },
});

const saveEmbedding = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Save embedding',
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'POST',
      url: rpcUrl('n8n_save_document_embedding'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '={{ JSON.stringify({ p_chunk_id: $json.id, p_embedding: $json.embedding_vector }) }}',
      ),
      options: { timeout: 60000 },
    },
  },
  output: [{ success: true }],
});

const clearDocumentBody = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Clear document body storage',
    onError: 'continueRegularOutput',
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'POST',
      url: rpcUrl('n8n_finalize_document_storage'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        "={{ JSON.stringify({ p_issue_id: $('Prepare embedding update SQL').item.json.issue_id, p_document_id: $('Prepare embedding update SQL').item.json.document_id }) }}",
      ),
      options: { timeout: 60000 },
    },
  },
  output: [{ success: true }],
});

const collectReadyIssues = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Collect ready issues',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const ids = new Set();
try {
  for (const item of $('Prepare embedding update SQL').all()) {
    const issueId = String(item.json?.issue_id || '').trim();
    if (issueId && !item.json?.skip) ids.add(issueId);
  }
} catch (_) {
  for (const item of $input.all()) {
    const issueId = String(item.json?.issue_id || '').trim();
    if (issueId) ids.add(issueId);
  }
}
if (!ids.size) return [];
return [...ids].map((stortinget_issue_id) => ({ json: { stortinget_issue_id } }));`,
    },
  },
  output: [{ stortinget_issue_id: '200329' }],
});

const triggerAiSummary = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Trigger AI summary',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: `${FOLKETS_N8N_BASE}/webhook/folkets-ai-summary`,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('={{ JSON.stringify({ stortinget_issue_id: $json.stortinget_issue_id }) }}'),
      options: { timeout: 15000 },
    },
  },
  output: [{ ok: true }],
});

const rateLimitPause = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: {
    name: 'Rate limit pause',
    parameters: {
      resume: 'timeInterval',
      amount: 2,
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
          { id: 'status', name: 'status', value: 'embedding_batch_complete', type: 'string' },
        ],
      },
    },
  },
  output: [{ status: 'embedding_batch_complete' }],
});

const logEmptyEmbeddingQueue = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Log empty embedding queue',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'outcome', name: 'outcome', value: 'empty_queue', type: 'string' },
          {
            id: 'message',
            name: 'message',
            value: 'No pending document_chunks to embed',
            type: 'string',
          },
        ],
      },
    },
  },
  output: [{ outcome: 'empty_queue' }],
});

const logEmbedFailure = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Log embed failure keep pending',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'outcome', name: 'outcome', value: 'embed_failed', type: 'string' },
          {
            id: 'message',
            name: 'message',
            value: 'Embedding failed; chunk remains pending for next run',
            type: 'string',
          },
        ],
      },
    },
  },
  output: [{ outcome: 'embed_failed' }],
});

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook document embeddings',
    parameters: {
      httpMethod: 'POST',
      path: 'folkets-document-embeddings',
      responseMode: 'onReceived',
      responseData: 'allEntries',
    },
  },
  output: [{ body: { stortinget_issue_id: '200329' } }],
});

const normalizeWebhook = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Normalize webhook payload',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'batch-limit', name: 'batchLimit', value: '12', type: 'string' },
          {
            id: 'issue-id',
            name: 'issueId',
            value: expr('{{ $json.body?.stortinget_issue_id || $json.stortinget_issue_id || "" }}'),
            type: 'string',
          },
        ],
      },
    },
  },
  output: [{ batchLimit: '12', issueId: '200329' }],
});

sticky(
  '## Dokument embeddings (RAG)\n\nPending chunks → Ollama `nomic-embed-text:v1.5` → pgvector. Tom kø er suksess. Etter lagring trigges AI-sammendrag for saken.',
  [scheduleTrigger, webhookTrigger],
  { color: 5 },
);

const savedEmbeddingPath = saveEmbedding
  .to(clearDocumentBody)
  .to(collectReadyIssues)
  .to(triggerAiSummary)
  .to(rateLimitPause)
  .to(batchRunComplete);

const embeddingPipeline = fetchPendingChunks.to(expandPendingChunks).to(
  hasPendingChunk
    .onTrue(
      embedChunk.to(mapEmbedding).to(prepareEmbeddingUpdate).to(
        hasEmbeddingVector.onTrue(savedEmbeddingPath).onFalse(logEmbedFailure),
      ),
    )
    .onFalse(logEmptyEmbeddingQueue),
);

export default workflow(
  'folkets-document-embeddings',
  'Folkets Stemme – dokument embeddings (RAG)',
)
  .add(scheduleTrigger)
  .to(embeddingSettings)
  .to(embeddingPipeline)
  .add(webhookTrigger)
  .to(normalizeWebhook)
  .to(embeddingPipeline);
