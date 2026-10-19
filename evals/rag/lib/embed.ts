const OLLAMA_BASE = (process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434').replace(/\/$/, '');

export async function embedBgeM3(text: string): Promise<number[]> {
  const input = text.trim().slice(0, 6000);
  const res = await fetch(`${OLLAMA_BASE}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.EMBED_QUERY_MODEL ?? 'bge-m3', input }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`bge-m3 embed failed: ${res.status}`);
  const payload = (await res.json()) as { embeddings?: number[][]; embedding?: number[] };
  const vector = payload.embeddings?.[0] ?? payload.embedding;
  if (!vector || vector.length !== 1024) {
    throw new Error(`bge-m3 expected 1024 dims, got ${vector?.length ?? 0}`);
  }
  return vector;
}

export async function embedNomic(text: string): Promise<number[]> {
  const prompt = text.trim().slice(0, 500);
  const res = await fetch(`${OLLAMA_BASE}/api/embeddings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`nomic embed failed: ${res.status}`);
  const payload = (await res.json()) as { embedding?: number[] };
  if (!payload.embedding || payload.embedding.length !== 768) {
    throw new Error(`nomic expected 768 dims, got ${payload.embedding?.length ?? 0}`);
  }
  return payload.embedding;
}
