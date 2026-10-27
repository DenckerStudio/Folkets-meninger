import {
  DOCUMENT_EMBEDDINGS_CONNECTION_ORDER,
  DOCUMENT_EMBEDDINGS_NODE_IDS,
  DOCUMENT_EMBEDDINGS_NODE_ORDER,
  DOCUMENT_EMBEDDINGS_POSITIONS,
  DOCUMENT_EMBEDDINGS_WEBHOOK_IDS,
  DOCUMENT_EMBEDDINGS_WORKFLOW_JSON_ID,
} from './document-embeddings.pins';

type JsonRecord = Record<string, unknown>;

export interface DocumentEmbeddingsWorkflowJson {
  id: string;
  name: string;
  nodes: JsonRecord[];
  connections: Record<string, JsonRecord>;
  settings?: JsonRecord;
  pinData?: JsonRecord;
  meta?: JsonRecord;
}

const NODE_FIELD_ORDER = [
  'parameters',
  'id',
  'name',
  'type',
  'typeVersion',
  'position',
  'webhookId',
  'disabled',
  'credentials',
  'retryOnFail',
  'maxTries',
  'waitBetweenTries',
  'alwaysOutputData',
  'onError',
] as const;

const ASSIGNMENT_FIELD_ORDER = ['id', 'name', 'value', 'type'] as const;

function normalizeAssignments(parameters: JsonRecord | undefined): void {
  if (!parameters || typeof parameters !== 'object') {
    return;
  }
  const assignments = parameters.assignments as JsonRecord | undefined;
  if (!assignments || !Array.isArray(assignments.assignments)) {
    return;
  }
  assignments.assignments = assignments.assignments.map((row: JsonRecord) => {
    const ordered: JsonRecord = {};
    for (const key of ASSIGNMENT_FIELD_ORDER) {
      if (key in row) {
        ordered[key] = row[key];
      }
    }
    for (const key of Object.keys(row)) {
      if (!(key in ordered)) {
        ordered[key] = row[key];
      }
    }
    return ordered;
  });
}

function normalizeOllamaConnections(connections: Record<string, JsonRecord>): void {
  const ollama = connections['Ollama embeddings'];
  if (!ollama) {
    return;
  }
  const errorBranch = ollama.error as unknown[][] | undefined;
  if (!errorBranch?.[0]?.length) {
    return;
  }
  const main = (ollama.main as unknown[][]) ?? [];
  const nextMain = [...main];
  while (nextMain.length < 2) {
    nextMain.push([]);
  }
  nextMain[1] = errorBranch[0];
  ollama.main = nextMain;
  delete ollama.error;
}

function reorderNodeFields(node: JsonRecord): JsonRecord {
  const ordered: JsonRecord = {};
  for (const key of NODE_FIELD_ORDER) {
    if (key in node && node[key] !== undefined) {
      ordered[key] = node[key];
    }
  }
  for (const key of Object.keys(node)) {
    if (!(key in ordered)) {
      ordered[key] = node[key];
    }
  }
  return ordered;
}

function applyNodePins(node: JsonRecord): JsonRecord {
  normalizeAssignments(node.parameters as JsonRecord | undefined);
  const name = String(node.name ?? '');
  const pinnedId = DOCUMENT_EMBEDDINGS_NODE_IDS[name];
  if (pinnedId) {
    node.id = pinnedId;
  }
  const pinnedWebhook = DOCUMENT_EMBEDDINGS_WEBHOOK_IDS[name];
  if (pinnedWebhook) {
    node.webhookId = pinnedWebhook;
  }
  const pinnedPosition = DOCUMENT_EMBEDDINGS_POSITIONS[name];
  if (pinnedPosition) {
    node.position = [...pinnedPosition];
  }
  return reorderNodeFields(node);
}

function orderConnections(connections: Record<string, JsonRecord>): Record<string, JsonRecord> {
  const ordered: Record<string, JsonRecord> = {};
  const seen = new Set<string>();
  for (const key of DOCUMENT_EMBEDDINGS_CONNECTION_ORDER) {
    if (connections[key] !== undefined) {
      ordered[key] = connections[key];
      seen.add(key);
    }
  }
  for (const key of Object.keys(connections).sort()) {
    if (!seen.has(key)) {
      ordered[key] = connections[key];
    }
  }
  return ordered;
}

function orderNodes(nodes: JsonRecord[]): JsonRecord[] {
  const byName = new Map(nodes.map((n) => [String(n.name), n]));
  const ordered: JsonRecord[] = [];
  const seen = new Set<string>();
  for (const name of DOCUMENT_EMBEDDINGS_NODE_ORDER) {
    const node = byName.get(name);
    if (node) {
      ordered.push(applyNodePins({ ...node }));
      seen.add(name);
    }
  }
  for (const node of nodes) {
    const name = String(node.name);
    if (!seen.has(name)) {
      ordered.push(applyNodePins({ ...node }));
    }
  }
  return ordered;
}

/** Apply prod pins and stable ordering for deterministic export vs committed JSON. */
export function canonicalizeDocumentEmbeddingsJson(
  json: DocumentEmbeddingsWorkflowJson,
): DocumentEmbeddingsWorkflowJson {
  const nodes = orderNodes(json.nodes.map((n) => ({ ...n })));
  const connections = orderConnections({ ...json.connections });
  normalizeOllamaConnections(connections);
  const result: DocumentEmbeddingsWorkflowJson = {
    id: json.id ?? DOCUMENT_EMBEDDINGS_WORKFLOW_JSON_ID,
    name: json.name,
    nodes,
    connections,
  };
  if (json.settings !== undefined) {
    result.settings = json.settings;
  } else {
    result.settings = {};
  }
  if (json.pinData !== undefined) {
    result.pinData = json.pinData;
  }
  if (json.meta !== undefined) {
    result.meta = json.meta;
  }
  return result;
}

export function serializeDocumentEmbeddingsJson(json: DocumentEmbeddingsWorkflowJson): string {
  return `${JSON.stringify(canonicalizeDocumentEmbeddingsJson(json), null, 2)}\n`;
}
