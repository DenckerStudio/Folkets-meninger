import {
  workflow,
  node,
  trigger,
  sticky,
  newCredential,
  expr,
  placeholder,
} from '@n8n/workflow-sdk';

const PENDING_CHUNKS_SQL = `SELECT
  c.id,
  c.issue_id,
  c.document_id,
  c.chunk_index,
  c.content
FROM public.document_chunks c
WHERE c.embedding_status = 'pending'
  AND ($1::text IS NULL OR $1::text = '' OR c.issue_id = $1::text)
ORDER BY c.created_at ASC
LIMIT $2`;

const PREPARE_EMBEDDING_UPDATE_JS = `const item = $input.item.json;
const embedding = item.embedding;
if (!Array.isArray(embedding) || embedding.length === 0) {
  throw new Error('Missing embedding vector');
}
const vector = '[' + embedding.join(',') + ']';
function esc(value) {
  return "'" + String(value ?? '').replace(/'/g, "''") + "'";
}
const updateSql = \`UPDATE public.document_chunks
SET embedding = '\${vector}'::vector,
    embedding_status = 'ready'
WHERE id = \${esc(item.id)}::uuid\`;
return { json: { ...item, updateSql } };`;

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
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch pending chunks',
    credentials: { postgres: newCredential('Supabase Postgres Folkets') },
    parameters: {
      operation: 'executeQuery',
      query: PENDING_CHUNKS_SQL,
      options: {
        queryReplacement: expr('{{ [ $json.issueId || null, $json.batchLimit || "8" ] }}'),
      },
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
return { json: { ...chunk, embedding } };`,
    },
  },
  output: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      issue_id: '200329',
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
  output: [{ updateSql: 'UPDATE public.document_chunks SET ...' }],
});

const saveEmbedding = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save embedding',
    credentials: { postgres: newCredential('Supabase Postgres Folkets') },
    parameters: {
      operation: 'executeQuery',
      query: expr('{{ $json.updateSql }}'),
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
  '## Dokument embeddings (RAG)\n\nHenter pending `document_chunks`, kaller Ollama `nomic-embed-text:v1.5` sekvensielt (ett item per node-kjøring), lagrer i pgvector.\n\nWebhook: `POST /webhook/folkets-document-embeddings` med valgfri `{ "stortinget_issue_id": "…" }`.',
  [scheduleTrigger, webhookTrigger],
  { color: 5 }
);

const embeddingPipeline = fetchPendingChunks
  .to(embedChunk)
  .to(mapEmbedding)
  .to(prepareEmbeddingUpdate)
  .to(saveEmbedding)
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
