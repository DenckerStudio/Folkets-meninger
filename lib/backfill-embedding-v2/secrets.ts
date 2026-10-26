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

const URL_WITH_CREDENTIALS_RE =
  /https?:\/\/(?:[^:@/\s]+):(?:[^@\s/]+)@(?:[^\s]+)/gi;
const BEARER_TOKEN_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const AUTHORIZATION_HEADER_RE = /\bAuthorization:\s*[^\s,;]+/gi;
const API_KEY_PAIR_RE = /\b(?:api[_-]?key|x-api-key)\s*[=:]\s*[^\s&;,]+/gi;

/** Strip URLs with embedded credentials, auth headers, and known secrets. */
export function redactSensitiveLogText(text: string, secrets: string[] = []): string {
  let out = text;
  out = out.replace(URL_WITH_CREDENTIALS_RE, (match) => {
    const at = match.indexOf('@');
    if (at < 0) return match;
    const prefix = match.slice(0, match.indexOf('://') + 3);
    const rest = match.slice(at + 1);
    return `${prefix}${MASK}@${rest}`;
  });
  out = out.replace(BEARER_TOKEN_RE, `Bearer ${MASK}`);
  out = out.replace(AUTHORIZATION_HEADER_RE, `Authorization: ${MASK}`);
  out = out.replace(API_KEY_PAIR_RE, (m) => m.replace(/[=:]\s*[^\s&;,]+/, `=${MASK}`));
  return redactKnownSecrets(out, secrets);
}

const SENSITIVE_ENV_NAMES = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'N8N_AI_SUMMARY_WEBHOOK_TOKEN',
  'CRON_SECRET',
  'BYOK_ENCRYPTION_KEY',
] as const;

export function collectSensitiveEnvValues(): string[] {
  const values: string[] = [];
  for (const name of SENSITIVE_ENV_NAMES) {
    const v = process.env[name]?.trim();
    if (v && v.length >= 4) values.push(v);
  }
  return values;
}

function appendErrorField(parts: string[], label: string, value: unknown): void {
  if (value === null || value === undefined) return;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) parts.push(`${label}=${trimmed}`);
    return;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    parts.push(`${label}=${String(value)}`);
  }
}

/** Turn RPC/PostgREST plain objects and other unknown throws into a log-safe string. */
function stringifyUnknownError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  if (err !== null && typeof err === 'object') {
    const record = err as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof record.message === 'string' && record.message.trim()) {
      parts.push(record.message.trim());
    }
    appendErrorField(parts, 'code', record.code);
    appendErrorField(parts, 'details', record.details);
    appendErrorField(parts, 'hint', record.hint);
    if (parts.length > 0) {
      return parts.join(' ');
    }
    try {
      return JSON.stringify(err);
    } catch {
      return '[unserializable error]';
    }
  }
  return String(err);
}

export function safeErrorMessage(err: unknown, secrets: string[] = []): string {
  const raw = stringifyUnknownError(err);
  return redactSensitiveLogText(raw, secrets);
}

export function formatFatalErrorForLog(err: unknown, secrets: string[] = []): string {
  const merged = [...secrets, ...collectSensitiveEnvValues()];
  const raw = stringifyUnknownError(err);
  return redactSensitiveLogText(raw, merged);
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
