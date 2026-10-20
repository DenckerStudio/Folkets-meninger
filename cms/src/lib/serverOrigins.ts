const LOCAL_CMS = 'http://localhost:3001';
const LOCAL_WEB = 'http://localhost:3000';

/** Public CMS origin (Payload serverURL, CORS, CSRF). */
export function resolveCmsServerUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  return (
    env.SERVER_URL?.trim() ||
    env.PAYLOAD_PUBLIC_SERVER_URL?.trim() ||
    env.NEXT_PUBLIC_SERVER_URL?.trim() ||
    LOCAL_CMS
  );
}

/** Public main site origin allowed to call the CMS with credentials. */
export function resolveWebPublicUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.WEB_PUBLIC_URL?.trim() || LOCAL_WEB;
}

/** Unique trusted origins for Payload cors/csrf (no wildcards). */
export function trustedPayloadOrigins(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const origins = [resolveCmsServerUrl(env), resolveWebPublicUrl(env)];
  return [...new Set(origins.filter((origin) => origin.length > 0))];
}

export const isProductionNodeEnv = (
  env: Record<string, string | undefined> = process.env,
): boolean => env.NODE_ENV === 'production';

export function hasExplicitCmsServerUrl(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(
    env.SERVER_URL?.trim() ||
      env.PAYLOAD_PUBLIC_SERVER_URL?.trim() ||
      env.NEXT_PUBLIC_SERVER_URL?.trim(),
  );
}

/** Fail fast on fm-cms boot when production has no public CMS origin configured. */
export function assertProductionCmsConfig(
  env: Record<string, string | undefined> = process.env,
): void {
  if (!isProductionNodeEnv(env)) return;
  if (!hasExplicitCmsServerUrl(env)) {
    throw new Error(
      'Production krever SERVER_URL (eller PAYLOAD_PUBLIC_SERVER_URL / NEXT_PUBLIC_SERVER_URL) satt til offentlig CMS-origin.',
    );
  }
  const url = resolveCmsServerUrl(env);
  if (!url.startsWith('https://')) {
    throw new Error('Production SERVER_URL må bruke https://.');
  }
}
