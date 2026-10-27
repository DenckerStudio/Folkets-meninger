/**
 * Production n8n workflow IkedEmJEJFqj7ZnM (version b6da4190) — pinned node ids and webhookIds.
 * N8N Expert: verify against a fresh live export before merge.
 */

export const DOCUMENT_EMBEDDINGS_WORKFLOW_JSON_ID = 'folkets-document-embeddings';

/** Node order in published prod export (stable JSON serialization). */
export const DOCUMENT_EMBEDDINGS_NODE_ORDER: readonly string[] = [
  'Embedding settings',
  'Ollama embeddings',
  'Map embedding vector',
  'Prepare embedding update SQL',
  'Rate limit pause',
  'Batch run complete',
  'Webhook document embeddings',
  'Normalize webhook payload',
  'Note',
  'Save embedding',
  'Clear document body storage',
  'Every 60 minutes',
  'Fetch pending chunks',
  'Expand pending chunks',
  'Has pending chunk?',
  'Log empty embedding queue',
  'Has embedding vector?',
  'Log embed failure keep pending',
  'Collect ready issues',
  'Error Trigger',
  'Format workflow error',
  'Error notify settings',
  'Varsle admin om feil',
  'Has issue id?',
  'Skip global drain (no issue id)',
];

/** Connection source node order in published prod export. */
export const DOCUMENT_EMBEDDINGS_CONNECTION_ORDER: readonly string[] = [
  'Ollama embeddings',
  'Map embedding vector',
  'Rate limit pause',
  'Webhook document embeddings',
  'Save embedding',
  'Every 60 minutes',
  'Embedding settings',
  'Fetch pending chunks',
  'Expand pending chunks',
  'Has pending chunk?',
  'Prepare embedding update SQL',
  'Has embedding vector?',
  'Clear document body storage',
  'Error Trigger',
  'Format workflow error',
  'Error notify settings',
  'Collect ready issues',
  'Normalize webhook payload',
  'Has issue id?',
];

export const DOCUMENT_EMBEDDINGS_NODE_IDS: Readonly<Record<string, string>> = {
  'Embedding settings': 'embedding-settings-node',
  'Ollama embeddings': 'embed-chunk-node',
  'Map embedding vector': 'map-embedding-node',
  'Prepare embedding update SQL': 'prepare-update-node',
  'Rate limit pause': 'rate-limit-pause-node',
  'Batch run complete': 'batch-complete-node',
  'Webhook document embeddings': 'webhook-trigger-node',
  'Normalize webhook payload': 'normalize-webhook-node',
  Note: 'sticky-note-node',
  'Save embedding': 'save-embedding-node',
  'Clear document body storage': 'clear-document-body-node',
  'Every 60 minutes': 'schedule-trigger-node',
  'Fetch pending chunks': 'c35324e4-0d90-42b3-85f0-dce1b1779529',
  'Expand pending chunks': '54304318-8148-4272-a011-8b5cbb89247e',
  'Has pending chunk?': '3a6be551-1a77-425f-ab60-2a3b76fd75ff',
  'Log empty embedding queue': '588af2bf-24a9-4c70-8ef2-8a16e46753df',
  'Has embedding vector?': 'b815fc16-a8b7-40ae-981c-e128d1637607',
  'Log embed failure keep pending': '092d1673-7f6f-476f-ad1b-3265ae8675b8',
  'Collect ready issues': 'e07d4a64-da7a-4af3-b12b-d047ce317380',
  'Error Trigger': 'bfe523fb-19c4-4eb7-8f92-761dd8bfd35c',
  'Format workflow error': '24ee36c4-e978-45fa-b2c5-da2b5f6717ae',
  'Error notify settings': '12d46758-b06f-44e4-ac63-82f1b8b566e6',
  'Varsle admin om feil': '999674d9-34d5-49eb-9c18-66ac9f86cee6',
  'Has issue id?': 'guard-has-issue-id',
  'Skip global drain (no issue id)': 'skip-global-drain-node',
};

export const DOCUMENT_EMBEDDINGS_WEBHOOK_IDS: Readonly<Record<string, string>> = {
  'Webhook document embeddings': 'd2700c9f-12c7-4ee4-b076-e603b8d70f57',
  'Rate limit pause': 'c6bb0235-5772-4349-8b4e-f8b36ddfc716',
};

/** Canvas positions from prod export IkedEmJEJFqj7ZnM (b6da4190). */
export const DOCUMENT_EMBEDDINGS_POSITIONS: Readonly<Record<string, [number, number]>> = {
  'Embedding settings': [464, 304],
  'Ollama embeddings': [1120, 304],
  'Map embedding vector': [1376, 304],
  'Prepare embedding update SQL': [1568, 304],
  'Rate limit pause': [2000, 304],
  'Batch run complete': [912, 512],
  'Webhook document embeddings': [240, 608],
  'Normalize webhook payload': [464, 608],
  Note: [80, -240],
  'Save embedding': [1792, 304],
  'Clear document body storage': [1904, 304],
  'Every 60 minutes': [240, 304],
  'Fetch pending chunks': [816, 304],
  'Expand pending chunks': [1024, 304],
  'Has pending chunk?': [1232, 304],
  'Log empty embedding queue': [1232, 512],
  'Has embedding vector?': [1680, 304],
  'Log embed failure keep pending': [1568, 512],
  'Collect ready issues': [2128, 304],
  'Error Trigger': [240, 912],
  'Format workflow error': [464, 912],
  'Error notify settings': [688, 912],
  'Varsle admin om feil': [912, 912],
  'Has issue id?': [640, 608],
  'Skip global drain (no issue id)': [880, 720],
};
