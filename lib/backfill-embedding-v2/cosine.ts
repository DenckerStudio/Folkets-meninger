/** Cosine similarity for equal-length float vectors (typical embedding compare). */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return NaN;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return NaN;
  return dot / denom;
}

export function minPairwiseCosine(vectors: number[][]): number {
  if (vectors.length < 2) {
    return vectors.length === 1 ? 1 : NaN;
  }
  let min = 1;
  for (let i = 0; i < vectors.length; i += 1) {
    for (let j = i + 1; j < vectors.length; j += 1) {
      const c = cosineSimilarity(vectors[i], vectors[j]);
      if (Number.isFinite(c) && c < min) {
        min = c;
      }
    }
  }
  return min;
}
