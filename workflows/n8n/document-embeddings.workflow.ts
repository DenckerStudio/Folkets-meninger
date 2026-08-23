import {
  workflow,
  node,
  trigger,
  sticky,
  newCredential,
  expr,
} from '@n8n/workflow-sdk';
import { FOLKETS_SUPABASE_CRED, FOLKETS_SUPABASE_REST } from './n8n-supabase.shared';

/**
 * RAG embeddings:
 * - App creates pending document_chunks (no HTML cache; document body cleared after chunking).
 * - n8n embeds with Ollama and writes vectors to Postgres (required for match_issue_document_chunks).
 * - After embed, mark document chunks_status=ready and clear any leftover body text.
 *
 * n8n is not a vector store — embeddings must stay in pgvector.
 */

const PREPARE_EMBEDDING_UPDATE_JS = `const item = $input.item.json;
const embedding = item.embedding;
if (!Array.isArray(embedding) || embedding.length === 0) {
  throw new Error('Missing embedding vector');
}
return {
  json: {
    ...item,
    embedding_vector: '[' + embedding.join(',') + ']',
  },
};`;

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
      url: `${FOLKETS_SUPABASE_REST}/rpc/n8n_list_pending_document_chunks`,
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
      jsCode: `const raw = $input.first()?.json;
let rows = [];
if (Array.isArray(raw)) rows = raw;
else if (Array.isArray(raw?.data)) rows = raw.data;
else if (raw && typeof raw === 'object' && raw.id) rows = [raw];
else {
  const all = $input.all().map((i) => i.json).filter(Boolean);
  if (all.length && all.every((r) => r && r.id && !Array.isArray(r))) rows = all;
}
return rows.map((r) => ({ json: r }));`,
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

const embedChunk = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Ollama embeddings',
    onError: 'continueErrorOutput',
    parameters: {
      method: 'POST',
      url: 'https://ollama.heyklever.app/api/embeddings',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '{"model":"nomic-embed-text:v1.5","prompt":{{ JSON.stringify($json.content) }}}'
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
      jsCode: PREPARE_EMBEDDING_UPDATE_JS,
    },
  },
  output: [{ embedding_vector: '[0.1,0.2,0.3]' }],
});

const saveEmbedding = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Save embedding',
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'POST',
      url: `${FOLKETS_SUPABASE_REST}/rpc/n8n_save_document_embedding`,
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
      url: `${FOLKETS_SUPABASE_REST}/rpc/n8n_finalize_document_storage`,
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
          {
            id: 'status',
            name: 'status',
            value: 'embedding_batch_complete',
            type: 'string',
          },
        ],
      },
    },
  },
  output: [{ status: 'embedding_batch_complete' }],
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
          {
            id: 'batch-limit',
            name: 'batchLimit',
            value: '12',
            type: 'string',
          },
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
  '## Dokument embeddings (lagringseffektiv RAG)\n\nAppen lagrer ikke HTML-cache; chunk-tekst er én kopi i `document_chunks`. n8n embedder med Ollama og skriver til pgvector (påkrevd for RAG — n8n er ikke vektorlager). Etter embed: `chunks_status=ready` + slett leftover `content_full_text`/`content_html`.\n\nWebhook: `POST /webhook/folkets-document-embeddings` med valgfri `{ "stortinget_issue_id": "…" }`.',
  [scheduleTrigger, webhookTrigger],
  { color: 5 }
);

const embeddingPipeline = fetchPendingChunks
  .to(expandPendingChunks)
  .to(embedChunk)
  .to(mapEmbedding)
  .to(prepareEmbeddingUpdate)
  .to(saveEmbedding)
  .to(clearDocumentBody)
  .to(rateLimitPause)
  .to(batchRunComplete);

export default workflow(
  'folkets-document-embeddings',
  'Folkets Stemme – dokument embeddings (RAG)'
)
  .add(scheduleTrigger)
  .to(embeddingSettings)
  .to(embeddingPipeline)
  .add(webhookTrigger)
  .to(normalizeWebhook)
  .to(embeddingPipeline);
