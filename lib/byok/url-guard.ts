import { lookup as dnsLookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

/** Client-safe copy when an outbound BYOK URL cannot be used (no URL/status/body). */
export const BYOK_OLLAMA_UNREACHABLE_NB =
  'Kunne ikke nå Ollama-serveren. Sjekk adressen under Profil → Stemme+ (BYOK).';

export const BYOK_BASE_URL_REJECTED_NB =
  'Adressen må være en offentlig http(s)-adresse. localhost og lokale nettverk (192.168.x, 10.x) støttes ikke.';

/** Uniform probe response for GET /api/byok/ollama/models (no oracle). */
export const BYOK_OLLAMA_PROBE_ERROR_NB =
  'Kunne ikke hente modellene. Sjekk at adressen er offentlig og tilgjengelig.';

export const BYOK_OLLAMA_PROBE_HTTP_STATUS = 400;

const DEFAULT_HTTP_PORT = 80;
const DEFAULT_HTTPS_PORT = 443;

const ALLOWED_EXPLICIT_PORTS = new Set([80, 443, 11434, 11435, 1234]);

const METADATA_IPV4 = '169.254.169.254';
const METADATA_IPV6 = 'fd00:ec2::254';

const PRIVATE_IPV4_CIDRS = [
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '100.64.0.0/10',
] as const;

const PRIVATE_IPV6_CIDR = 'fc00::/7';

const BLOCKED_IPV6_CIDRS = [
  '::/96',
  '64:ff9b::/96',
  '2002::/16',
  '2001::/32',
  '100::/64',
  '::ffff:0:0/96',
] as const;

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
  const host = normalizeHostnameForCheck(url.hostname);
  return `${url.protocol}//${host}:${port}`;
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

/** Strip trailing dot and lowercase for hostname policy checks. */
export function normalizeHostnameForCheck(host: string): string {
  let normalized = host.trim().toLowerCase();
  while (normalized.endsWith('.')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function isBlockedHostname(host: string): boolean {
  const lower = normalizeHostnameForCheck(host);
  if (lower === 'localhost' || lower.endsWith('.localhost')) return true;
  if (lower.endsWith('.local')) return true;
  if (lower.endsWith('.internal')) return true;
  if (METADATA_HOST_PATTERNS.some((pattern) => pattern.test(lower))) return true;
  return false;
}

function isSingleLabelHostname(host: string): boolean {
  const normalized = normalizeHostnameForCheck(host);
  if (normalized.includes(':')) return false;
  if (normalized.startsWith('[') && normalized.endsWith(']')) return false;
  if (normalized.includes('.')) return false;
  if (isIpv4Literal(normalized)) return false;
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

function isMetadataIpAddress(address: string): boolean {
  const lower = address.trim().toLowerCase();
  if (lower === METADATA_IPV4) return true;
  if (lower === METADATA_IPV6) return true;
  try {
    const parsed = ipaddr.parse(address);
    if (parsed.kind() === 'ipv6' && parsed.toString().toLowerCase() === METADATA_IPV6) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function isPrivateUnicast(ip: ipaddr.IPv4 | ipaddr.IPv6): boolean {
  if (ip.kind() === 'ipv4') {
    return PRIVATE_IPV4_CIDRS.some((cidr) => ip.match(ipaddr.parseCIDR(cidr)));
  }
  return ip.match(ipaddr.parseCIDR(PRIVATE_IPV6_CIDR));
}

/** @internal Exported for tests. */
export function assertIpAllowedSync(address: string, allowPrivate: boolean): void {
  if (isMetadataIpAddress(address)) {
    throw new ByokUrlRejectedError(BYOK_BASE_URL_REJECTED_NB, `metadata ${address}`);
  }

  let ip: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    ip = ipaddr.parse(address);
  } catch {
    throw new ByokUrlRejectedError(BYOK_BASE_URL_REJECTED_NB, `invalid ip ${address}`);
  }

  if (ip.kind() === 'ipv6') {
    const v6 = ip as ipaddr.IPv6;
    if (BLOCKED_IPV6_CIDRS.some((cidr) => v6.match(ipaddr.parseCIDR(cidr)))) {
      throw new ByokUrlRejectedError(BYOK_BASE_URL_REJECTED_NB, `blocked ipv6 cidr ${address}`);
    }
    if (v6.isIPv4MappedAddress()) {
      ip = v6.toIPv4Address();
    }
  }

  if (isMetadataIpAddress(ip.toString())) {
    throw new ByokUrlRejectedError(BYOK_BASE_URL_REJECTED_NB, `metadata ${address}`);
  }

  const range = ip.range();
  const alwaysBlocked = new Set([
    'loopback',
    'linkLocal',
    'multicast',
    'broadcast',
    'reserved',
    'unspecified',
  ]);
  if (alwaysBlocked.has(range)) {
    throw new ByokUrlRejectedError(BYOK_BASE_URL_REJECTED_NB, `non-unicast ${range} ${address}`);
  }

  if (allowPrivate && range === 'private') {
    return;
  }

  if (range !== 'unicast') {
    throw new ByokUrlRejectedError(BYOK_BASE_URL_REJECTED_NB, `non-unicast ${range} ${address}`);
  }

  if (!allowPrivate && isPrivateUnicast(ip)) {
    throw new ByokUrlRejectedError(BYOK_BASE_URL_REJECTED_NB, `private ${address}`);
  }
}

export function createValidatingDnsLookup(
  access: ByokOutboundAccess,
  allowPrivate: boolean,
): DnsLookupFn {
  const underlying = access.lookup ?? defaultLookup;
  return async (hostname, options) => {
    const results = await underlying(hostname, options);
    for (const entry of results) {
      assertIpAllowedSync(entry.address, allowPrivate);
    }
    return results;
  };
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

  const host = normalizeHostnameForCheck(url.hostname);
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
    assertIpAllowedSync(literalV4, options.allowPrivate);
    return;
  }

  if (host.startsWith('[') && host.endsWith(']')) {
    const inner = host.slice(1, -1);
    assertIpAllowedSync(inner, options.allowPrivate);
    return;
  }

  if (ipaddr.isValid(host)) {
    assertIpAllowedSync(host, options.allowPrivate);
    return;
  }

  const lookup = options.lookup ?? defaultLookup;
  const results = await lookup(host, { all: true, verbatim: true });
  if (!results.length) {
    throw new ByokUrlRejectedError(BYOK_BASE_URL_REJECTED_NB, `no dns for ${host}`);
  }
  for (const entry of results) {
    assertIpAllowedSync(entry.address, options.allowPrivate);
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
  const lookup = createValidatingDnsLookup(access, allowPrivate);
  await assertSafeOutboundUrl(trimmed, { allowPrivate, lookup });
}
