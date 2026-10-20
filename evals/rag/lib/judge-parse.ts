export type ParsedJudgeScores = {
  faithfulness: number;
  quality: number;
  justification: string;
};

/** Strip markdown fences and surrounding noise before JSON extraction. */
export function stripJudgeResponseFences(text: string): string {
  let t = text.trim();
  const fence = /^```(?:json)?\s*\n?/i;
  if (fence.test(t)) {
    t = t.replace(fence, '').replace(/\n?```\s*$/i, '').trim();
  }
  return t;
}

/** First balanced `{ ... }` object in text (avoids greedy trailing garbage). */
export function extractJsonObject(text: string): string | null {
  const stripped = stripJudgeResponseFences(text);
  const start = stripped.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < stripped.length; i += 1) {
    const ch = stripped[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return stripped.slice(start, i + 1);
    }
  }
  return null;
}

export function parseJudgeScoresJson(text: string): ParsedJudgeScores | null {
  const block = extractJsonObject(text);
  if (!block) return null;
  try {
    const parsed = JSON.parse(block) as {
      faithfulness?: number;
      quality?: number;
      justification?: string;
      note?: string;
    };
    const faith = Number(parsed.faithfulness);
    const qual = Number(parsed.quality);
    if (!Number.isFinite(faith) || !Number.isFinite(qual)) return null;
    const justification = (parsed.justification ?? parsed.note ?? '').trim();
    return { faithfulness: faith, quality: qual, justification };
  } catch {
    return null;
  }
}

export function buildJudgeRetryPrompt(row: {
  query: string;
  priorResponse: string;
}): string {
  return `Return valid JSON only. No markdown, no code fences, no commentary.
Schema: {"faithfulness":0|0.25|0.5|0.75|1,"quality":0|0.25|0.5|0.75|1,"justification":"string"}

Previous invalid output:
${row.priorResponse.slice(0, 800)}

Question: ${row.query}
Output JSON:`;
}
