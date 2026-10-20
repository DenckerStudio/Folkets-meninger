const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseClientResearchRequestId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const raw = (body as Record<string, unknown>).request_id;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return UUID_RE.test(trimmed) ? trimmed : null;
}
