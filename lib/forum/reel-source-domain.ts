export function extractNewsHostname(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
}

export function hostnameMatchesTrustedDomain(hostname: string, trustedDomain: string): boolean {
  const normalizedHost = hostname.replace(/^www\./i, '').toLowerCase();
  const normalizedDomain = trustedDomain.replace(/^www\./i, '').toLowerCase();
  return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
}
