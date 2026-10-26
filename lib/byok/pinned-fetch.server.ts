import {
  Agent,
  fetch as undiciFetch,
  type Dispatcher,
  type RequestInit as UndiciRequestInit,
} from 'undici';
import type { LookupAddress, LookupOptions } from 'node:dns';
import type { LookupFunction } from 'node:net';
import {
  type ByokOutboundAccess,
  assertSafeOutboundUrl,
  createValidatingDnsLookup,
  resolveAllowPrivateForUrl,
} from '@/lib/byok/url-guard';

/** Compatible with the AI SDK and Node test mocks (wraps undici fetch + dispatcher). */
export type ByokOutboundFetch = typeof fetch;

export type ByokPinnedFetch = ByokOutboundFetch & { dispatcher: Dispatcher };

function outboundHref(input: Parameters<typeof undiciFetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  const record = input as { url?: string };
  if (typeof record.url === 'string') return record.url;
  throw new Error('unsupported fetch input');
}

function isLookupAllOptions(options: LookupOptions): boolean {
  return Boolean(options && typeof options === 'object' && options.all);
}

export function createPinnedByokDispatcher(
  access: ByokOutboundAccess,
  allowPrivate: boolean,
  permittedOrigin: string | null,
): Dispatcher {
  const validatingLookup = createValidatingDnsLookup(access, allowPrivate, permittedOrigin);

  const lookupFn: LookupFunction = (hostname, options, callback) => {
    void validatingLookup(hostname, { all: true, verbatim: true })
      .then((results) => {
        if (!results.length) {
          const err = Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
          (callback as (error: NodeJS.ErrnoException) => void)(err);
          return;
        }

        if (isLookupAllOptions(options)) {
          const addresses: LookupAddress[] = results.map((entry) => ({
            address: entry.address,
            family: entry.family,
          }));
          (callback as (err: null, addresses: LookupAddress[]) => void)(null, addresses);
          return;
        }

        const first = results[0];
        callback(null, first.address, first.family);
      })
      .catch((error: unknown) => {
        const err =
          error instanceof Error
            ? error
            : Object.assign(new Error('lookup failed'), { code: 'EAI_FAIL' });
        (callback as (error: NodeJS.ErrnoException) => void)(err as NodeJS.ErrnoException);
      });
  };

  return new Agent({
    connect: {
      lookup: lookupFn,
    },
  });
}

export function createByokPinnedFetch(
  access: ByokOutboundAccess,
  baseUrl: string,
): ByokPinnedFetch {
  const allowPrivate = resolveAllowPrivateForUrl(baseUrl, access);
  const permittedOrigin = allowPrivate ? baseUrl : null;
  const lookup = createValidatingDnsLookup(access, allowPrivate, permittedOrigin);
  const dispatcher = createPinnedByokDispatcher(access, allowPrivate, permittedOrigin);

  const pinnedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = outboundHref(input as Parameters<typeof undiciFetch>[0]);
    await assertSafeOutboundUrl(href, { allowPrivate, lookup, permittedOrigin });
    const undiciInit: UndiciRequestInit = {
      ...(init as UndiciRequestInit),
      redirect: 'manual',
      dispatcher,
    };
    const response = await undiciFetch(
      input as Parameters<typeof undiciFetch>[0],
      undiciInit,
    );
    return response as unknown as Response;
  }) as ByokPinnedFetch;

  pinnedFetch.dispatcher = dispatcher;
  return pinnedFetch;
}
