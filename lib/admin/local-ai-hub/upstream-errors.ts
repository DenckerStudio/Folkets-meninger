export function shortenUpstreamError(raw: string, fallback = 'Ukjent feil fra ekstern tjeneste'): string {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  try {
    const parsed = JSON.parse(trimmed) as { message?: string; error?: string };
    const msg = parsed.message ?? parsed.error;
    if (typeof msg === 'string' && msg.trim()) {
      return msg.trim().length > 160 ? `${msg.trim().slice(0, 160)}…` : msg.trim();
    }
  } catch {
    // ikke JSON
  }
  if (trimmed.length > 160) {
    return `${trimmed.slice(0, 160)}…`;
  }
  return trimmed;
}