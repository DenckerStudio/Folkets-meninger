import {
  workflow,
  node,
  trigger,
  sticky,
  expr,
  placeholder,
} from '@n8n/workflow-sdk';
import { folketsSupabaseCredential } from './workflow-credentials';

/**
 * RAG embeddings:
 * - App creates pending document_chunks (no HTML cache; document body cleared after chunking).
 * - n8n embeds with Ollama and writes vectors via Supabase API (required for match_issue_document_chunks).
 * - After embed, mark document chunks_status=ready and clear any leftover body text.
 *
 * n8n is not a vector store — embeddings must stay in pgvector.
 */

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Every 60 minutes',
    parameters: {
      rule: {
        interval: [{ field: 'minutes', minutesInterval: 60 }],
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
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Fetch pending chunks',
    credentials: folketsSupabaseCredential,
    parameters: {
      resource: 'row',
      operation: 'getAll',
      tableId: 'document_chunks',
      returnAll: false,
      limit: expr('{{ Number($json.batchLimit || 8) }}'),
      filterType: 'string',
      filterString: expr(
        '{{ "embedding_status=eq.pending&order=created_at.asc" + ($json.issueId ? "&issue_id=eq." + $json.issueId : "") }}'
      ),
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
      url: placeholder('https://ollama.example.com/api/embeddings'),
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
      jsCode: `const chunk = $('Fetch pending chunks').item.json;
const response = $input.item.json;
const embedding = response.embedding;
if (!Array.isArray(embedding) || embedding.length === 0) {
  throw new Error('Missing embedding vector');
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

const saveEmbedding = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Save embedding',
    credentials: folketsSupabaseCredential,
    parameters: {
      resource: 'row',
      operation: 'update',
      tableId: 'document_chunks',
      filterType: 'manual',
      matchType: 'allFilters',
      filters: {
        conditions: [
          {
            keyName: 'id',
            condition: 'eq',
            keyValue: expr('{{ $json.id }}'),
          },
        ],
      },
      dataToSend: 'defineBelow',
      fieldsUi: {
        fieldValues: [
          {
            fieldId: 'embedding',
            fieldValue: expr('{{ $json.embedding }}'),
          },
          {
            fieldId: 'embedding_status',
            fieldValue: 'ready',
          },
        ],
      },
    },
  },
  output: [{ id: '00000000-0000-0000-0000-000000000001', embedding_status: 'ready' }],
});

const clearDocumentBody = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Clear document body storage',
    credentials: folketsSupabaseCredential,
    parameters: {
      resource: 'row',
      operation: 'getAll',
      tableId: 'rpc/n8n_finalize_document_embedding',
      returnAll: true,
      filterType: 'string',
      filterString: expr(
        '{{ "p_issue_id=" + encodeURIComponent($json.issue_id) + "&p_document_id=" + encodeURIComponent($json.document_id) }}'
      ),
    },
  },
  output: [{ ok: true, issue_id: '200329', document_id: 'inns-202526-434s', chunks_status: 'ready' }],
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
  '## Dokument embeddings (lagringseffektiv RAG)\n\nAppen lagrer ikke HTML-cache; chunk-tekst er én kopi i `document_chunks`. n8n embedder med Ollama og skriver til pgvector via Supabase API (påkrevd for RAG — n8n er ikke vektorlager). Etter embed: `chunks_status=ready` + slett leftover `content_full_text`/`content_html`.\n\n**Supabase credential:** «Folkets-meninger».\n\nWebhook: `POST /webhook/folkets-document-embeddings` med valgfri `{ "stortinget_issue_id": "…" }`.',
  [scheduleTrigger, webhookTrigger],
  { color: 5 }
);

const embeddingPipeline = fetchPendingChunks
  .to(embedChunk)
  .to(mapEmbedding)
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
