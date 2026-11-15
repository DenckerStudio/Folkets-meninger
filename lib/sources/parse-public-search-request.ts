/** Keys the client must never send — search text is built server-side only. */
export const FORBIDDEN_PUBLIC_SEARCH_BODY_KEYS = [
  'q',
  'query',
  'search',
  'searchQuery',
  'text',
  'prompt',
  'keywords',
  'title',
  'note',
  'notes',
] as const;

export type ParsePublicSearchBodyResult =
  | { ok: true; body: Record<string, never> }
  | { ok: false; code: 'invalid_body'; message: string };

/**
 * Admin «Finn flere kilder» may not pass free-text search strings.
 * Scope comes from the URL (topic id / issue id) only.
 */
export function parsePublicSearchRequestBody(raw: unknown): ParsePublicSearchBodyResult {
  if (raw === undefined || raw === null) {
    return { ok: true, body: {} };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      code: 'invalid_body',
      message: 'Ugyldig forespørsel: søketekst må ikke sendes fra klienten',
    };
  }
  const record = raw as Record<string, unknown>;
  for (const key of FORBIDDEN_PUBLIC_SEARCH_BODY_KEYS) {
    if (key in record) {
      return {
        ok: false,
        code: 'invalid_body',
        message: 'Ugyldig forespørsel: søketekst må ikke sendes fra klienten',
      };
    }
  }
  const keys = Object.keys(record);
  if (keys.length > 0) {
    return {
      ok: false,
      code: 'invalid_body',
      message: 'Ugyldig forespørsel: kun strukturert omfang (tema- eller sak-id i URL)',
    };
  }
  return { ok: true, body: {} };
}