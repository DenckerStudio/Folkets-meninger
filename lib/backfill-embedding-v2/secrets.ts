const MASK = '***';

export function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return MASK;
  if (trimmed.length <= 8) return MASK;
  return `${trimmed.slice(0, 2)}${MASK}${trimmed.slice(-2)}`;
}

/** Read API key from env var name only (never from config JSON). */
export function resolveApiKeyFromEnvVarName(envVarName: string | undefined): string | undefined {
  const name = envVarName?.trim();
  if (!name) return undefined;
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function redactKnownSecrets(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (!secret || secret.length < 4) continue;
    out = out.split(secret).join(maskSecret(secret));
  }
  return out;
}

export function safeErrorMessage(err: unknown, secrets: string[] = []): string {
  const raw = err instanceof Error ? err.message : String(err);
  return redactKnownSecrets(raw, secrets);
}

export function collectEndpointSecrets(
  endpoints: { apiKey?: string }[],
): string[] {
  const set = new Set<string>();
  for (const ep of endpoints) {
    if (ep.apiKey) set.add(ep.apiKey);
  }
  return [...set];
}
