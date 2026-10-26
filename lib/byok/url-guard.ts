import { lookup as dnsLookup } from 'node:dns/promises';

/** Client-safe copy when an outbound BYOK URL cannot be used (no URL/status/body). */
export const BYOK_OLLAMA_UNREACHABLE_NB =
  'Kunne ikke nå Ollama-serveren. Sjekk adressen.';

export const BYOK_BASE_URL_REJECTED_NB =
  'Base-URL-en er ikke tillatt. Sjekk adressen du skrev inn.';

const DEFAULT_HTTP_PORT = 80;
const DEFAULT_HTTPS_PORT = 443;

const ALLOWED_EXPLICIT_PORTS = new Set([80, 443, 11434, 11435, 1234]);

const BLOCKED_HOSTNAMES = new Set(['localhost']);

const METADATA_HOST_PATTERNS = [
  /^metadata$/i,
  /^metadata\./i,
  /\.metadata$/i,
  /^metadata\.google\.internal$/i,
];

export type DnsLookupFn = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<Array<{ address: string; family: number }>>;

export type ByokOutboundAccess = {
  isAdmin: boolean;
  lookup?: DnsLookupFn;
  /** @internal test hook */
  allowlistOrigins?: readonly string[];
};

export class ByokUrlRejectedError extends Error {
  readonly clientMessage: string;

  constructor(clientMessage: string, detail?: string) {
    super(detail ?? clientMessage);
    this.name = 'ByokUrlRejectedError';
    this.clientMessage = clientMessage;
  }
}

function defaultLookup(hostname: string) {
  return dnsLookup(hostname, { all: true, verbatim: true });
}

export function readPrivateUrlAllowlistFromEnv(
  envValue: string | undefined = process.env.BYOK_PRIVATE_URL_ALLOWLIST,
): string[] {
  const raw = envValue?.trim();
  if (!raw) return [];
  const origins: string[] = [];
  for (const part of raw.split(',')) {
    const normalized = normalizeAllowlistOrigin(part.trim());
    if (normalized) origins.push(normalized);
  }
  return origins;
}

/** Canonical origin for allowlist comparison (`protocol//host:port`). */
export function normalizeAllowlistOrigin(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    const port = resolvePort(url);
    if (!ALLOWED_EXPLICIT_PORTS.has(port)) return null;
    return originKey(url);
  } catch {
    return null;
  }
}

function originKey(url: URL): string {
  const port =
    url.port ||
    (url.protocol === 'https:' ? String(DEFAULT_HTTPS_PORT) : String(DEFAULT_HTTP_PORT));
  return `${url.protocol}//${url.hostname.toLowerCase()}:${port}`;
}

function resolvePort(url: URL): number {
  if (url.port) {
    const parsed = Number.parseInt(url.port, 10);
    if (!Number.isFinite(parsed)) return -1;
    return parsed;
  }
  return url.protocol === 'https:' ? DEFAULT_HTTPS_PORT : DEFAULT_HTTP_PORT;
}

function assertAllowedPort(url: URL): void {
  const port = resolvePort(url);
  if (!ALLOWED_EXPLICIT_PORTS.has(port)) {
    throw new ByokUrlRejectedError(BYOK_BASE_URL_REJECTED_NB, `blocked port ${port}`);
  }
}

function isBlockedHostname(host: string): boolean {
  const lower = host.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  if (lower.endsWith('.local')) return true;
  if (lower.endsWith('.internal')) return true;
  if (METADATA_HOST_PATTERNS.some((pattern) => pattern.test(lower))) return true;
  return false;
}

function isSingleLabelHostname(host: string): boolean {
  if (host.includes(':')) return false;
  if (host.startsWith('[') && host.endsWith(']')) return false;
  if (host.includes('.')) return false;
  if (isIpv4Literal(host)) return false;
  return true;
}

function isIpv4Literal(host: string): boolean {
  return parseIpv4Literal(host) !== null;
}

function parseIpv4Literal(host: string): string | null {
  const trimmed = host.trim();
  if (!trimmed) return null;

  if (/^0x[0-9a-f]+$/i.test(trimmed)) {
    const value = Number.parseInt(trimmed, 16);
    if (!Number.isFinite(value) || value < 0 || value > 0xffffffff) return null;
    return ipv4FromUint32(value >>> 0);
  }

  if (/^\d+$/.test(trimmed)) {
    const value = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(value) || value < 0 || value > 0xffffffff) return null;
    return ipv4FromUint32(value >>> 0);
  }

  const parts = trimmed.split('.');
  if (parts.length !== 4) return null;

  const octets: number[] = [];
  for (const part of parts) {
    if (!part.length) return null;
    let value: number;
    if (/^0x[0-9a-f]+$/i.test(part)) {
      value = Number.parseInt(part, 16);
    } else if (/^0[0-7]+$/.test(part)) {
      value = Number.parseInt(part, 8);
    } else if (/^\d+$/.test(part)) {
      value = Number.parseInt(part, 10);
    } else {
      return null;
    }
    if (!Number.isFinite(value) || value < 0 || value > 255) return null;
    octets.push(value);
  }
  return octets.join('.');
}

function ipv4FromUint32(value: number): string {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ].join('.');
}

function parseIpv6Address(address: string): bigint | null {
  const lower = address.toLowerCase();
  if (lower.includes('.')) {
    const lastColon = lower.lastIndexOf(':');
    if (lastColon === -1) return null;
    const v4 = parseIpv4Literal(lower.slice(lastColon + 1));
    if (!v4) return null;
    const v4Parts = v4.split('.').map((p) => Number.parseInt(p, 10));
    const high = ((v4Parts[0] << 8) | v4Parts[1]) & 0xffff;
    const low = ((v4Parts[2] << 8) | v4Parts[3]) & 0xffff;
    const mapped = `::ffff:${high.toString(16)}:${low.toString(16)}`;
    return parseIpv6Address(mapped);
  }

  const [head, tail] = lower.split('::');
  const headParts = head ? head.split(':').filter(Boolean) : [];
  const tailParts = tail ? tail.split(':').filter(Boolean) : [];
  const missing = 8 - (headParts.length + tailParts.length);
  if (missing < 0) return null;
  const full = [...headParts, ...Array(missing).fill('0'), ...tailParts];
  if (full.length !== 8) return null;

  let value = BigInt(0);
  for (const part of full) {
    const piece = Number.parseInt(part, 16);
    if (!Number.isFinite(piece) || piece < 0 || piece > 0xffff) return null;
    value = (value << BigInt(16)) + BigInt(piece);
  }
  return value;
}

type IpBlockReason =
  | 'loopback'
  | 'unspecified'
  | 'private'
  | 'link_local'
  | 'cgnat'
  | 'multicast'
  | 'reserved'
  | 'metadata';

function classifyIpv4(octets: number[]): IpBlockReason | null {
  const [a, b] = octets;
  if (a === 127) return 'loopback';
  if (a === 0) return 'unspecified';
  if (a === 10) return 'private';
  if (a === 172 && b >= 16 && b <= 31) return 'private';
  if (a === 192 && b === 168) return 'private';
  if (a === 169 && b === 254) return 'link_local';
  if (a === 100 && b >= 64 && b <= 127) return 'cgnat';
  if (a >= 224 && a <= 239) return 'multicast';
  if (a >= 240) return 'reserved';
  return null;
}

function classifyIpv6(value: bigint): IpBlockReason | null {
  if (value === BigInt(0)) return 'unspecified';
  if (value === BigInt(1)) return 'loopback';
  const mappedPrefix = value >> BigInt(32);
  if (mappedPrefix === BigInt(0xffff)) {
    const v4 = Number(value & BigInt(0xffffffff));
    const octets = [
      (v4 >>> 24) & 0xff,
      (v4 >>> 16) & 0xff,
      (v4 >>> 8) & 0xff,
      v4 & 0xff,
    ];
    return classifyIpv4(octets);
  }
  const firstHextet = Number(value >> BigInt(112)) & 0xffff;
  if ((firstHextet & 0xfe00) === 0xfc00) return 'private';
  if ((firstHextet & 0xffc0) === 0xfe80) return 'link_local';
  if ((firstHextet & 0xff00) === 0xff00) return 'multicast';
  return null;
}

function classifyIpAddress(address: string): IpBlockReason | null {
  const v4 = parseIpv4Literal(address);
  if (v4) {
    const octets = v4.split('.').map((p) => Number.parseInt(p, 10));
    const reason = classifyIpv4(octets);
    if (reason === 'link_local' && octets[0] === 169 && octets[1] === 254 && octets[2] === 169 && octets[3] === 254) {
      return 'metadata';
    }
    return reason;
  }

  const v6 = parseIpv6Address(address);
  if (v6 !== null) {
    return classifyIpv6(v6);
  }
  return 'reserved';
}

function assertIpAllowed(address: string, allowPrivate: boolean): void {
  const reason = classifyIpAddress(address);
  if (!reason) return;
  if (reason === 'metadata') {
    throw new ByokUrlRejectedError(BYOK_BASE_URL_REJECTED_NB, `metadata address ${address}`);
  }
  if (allowPrivate && reason === 'private') return;
  throw new ByokUrlRejectedError(BYOK_BASE_URL_REJECTED_NB, `blocked ${reason} ${address}`);
}

export function privateAllowlistPermitsUrl(
  urlString: string,
  access: Pick<ByokOutboundAccess, 'isAdmin' | 'allowlistOrigins'>,
): boolean {
  if (!access.isAdmin) return false;
  const allowlist =
    access.allowlistOrigins ?? readPrivateUrlAllowlistFromEnv();
  if (allowlist.length === 0) return false;
  try {
    const origin = originKey(new URL(urlString));
    return allowlist.includes(origin);
  } catch {
    return false;
  }
}

export function resolveAllowPrivateForUrl(
  urlString: string,
  access: Pick<ByokOutboundAccess, 'isAdmin' | 'allowlistOrigins'>,
): boolean {
  return privateAllowlistPermitsUrl(urlString, access);
}

/**
 * Validate a URL before fm-web fetches it server-side (BYOK base URLs and derived endpoints).
 */
export async function assertSafeOutboundUrl(
  urlString: string,
  options: { allowPrivate: boolean; lookup?: DnsLookupFn },
): Promise<void> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new ByokUrlRejectedError(BYOK_BASE_URL_REJECTED_NB, 'invalid url');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ByokUrlRejectedError(BYOK_BASE_URL_REJECTED_NB, `protocol ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new ByokUrlRejectedError(BYOK_BASE_URL_REJECTED_NB, 'credentials in url');
  }

  assertAllowedPort(url);

  const host = url.hostname;
  if (!host) {
    throw new ByokUrlRejectedError(BYOK_BASE_URL_REJECTED_NB, 'empty host');
  }
  if (isBlockedHostname(host)) {
    throw new ByokUrlRejectedError(BYOK_BASE_URL_REJECTED_NB, `hostname ${host}`);
  }
  if (isSingleLabelHostname(host)) {
    throw new ByokUrlRejectedError(BYOK_BASE_URL_REJECTED_NB, `single-label ${host}`);
  }

  const literalV4 = parseIpv4Literal(host);
  if (literalV4) {
    assertIpAllowed(literalV4, options.allowPrivate);
    return;
  }

  if (host.startsWith('[') && host.endsWith(']')) {
    const inner = host.slice(1, -1);
    assertIpAllowed(inner, options.allowPrivate);
    return;
  }

  const lookup = options.lookup ?? defaultLookup;
  const results = await lookup(host, { all: true, verbatim: true });
  if (!results.length) {
    throw new ByokUrlRejectedError(BYOK_BASE_URL_REJECTED_NB, `no dns for ${host}`);
  }
  for (const entry of results) {
    assertIpAllowed(entry.address, options.allowPrivate);
  }
}

export async function assertSafeByokBaseUrl(
  baseUrl: string,
  access: ByokOutboundAccess,
): Promise<void> {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    throw new ByokUrlRejectedError(BYOK_BASE_URL_REJECTED_NB, 'empty base url');
  }
  const allowPrivate = resolveAllowPrivateForUrl(trimmed, access);
  await assertSafeOutboundUrl(trimmed, { allowPrivate, lookup: access.lookup });
}

export function createSsrfGuardedFetch(
  validate: (url: string) => Promise<void>,
  fetchImpl: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    const href =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    await validate(href);
    const response = await fetchImpl(input, { ...init, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      throw new Error('redirect blocked');
    }
    return response;
  };
}
