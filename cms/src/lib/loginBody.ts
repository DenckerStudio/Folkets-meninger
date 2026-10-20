/** Normalized login identifier for rate-limit keys (email or username). */
export function loginIdentifierFromBody(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const record = body as Record<string, unknown>;
  const email = typeof record.email === 'string' ? record.email.trim().toLowerCase() : '';
  if (email) return email;
  const username =
    typeof record.username === 'string' ? record.username.trim().toLowerCase() : '';
  return username;
}
