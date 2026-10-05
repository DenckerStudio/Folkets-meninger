import {
  isSakContextEmpty,
  parseSakContextInput,
  type SakContextActionResult,
} from '@/lib/chat/actions';
import { retrieveSakContext, type ChatRagClient } from '@/lib/chat/rag';

/** Same path as the BYOK `retrieveSakContext` tool — session/anon cache, no LLM. */
export async function runSakContextRetrieve(input: {
  issueId?: string | null;
  query?: string | null;
  client?: ChatRagClient | null;
}): Promise<{ ok: true; result: SakContextActionResult } | { ok: false; error: string }> {
  const parsed = parseSakContextInput(input);
  if (!parsed.ok) return parsed;

  const context = await retrieveSakContext({
    issueId: parsed.issueId,
    query: parsed.query,
    client: input.client,
  });

  return {
    ok: true,
    result: {
      ...context,
      empty: isSakContextEmpty(context),
    },
  };
}
