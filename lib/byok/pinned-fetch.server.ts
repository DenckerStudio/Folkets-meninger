import { Agent, type Dispatcher } from 'undici';
import type { LookupFunction } from 'node:net';
import {
  type ByokOutboundAccess,
  assertSafeOutboundUrl,
  createValidatingDnsLookup,
  resolveAllowPrivateForUrl,
} from '@/lib/byok/url-guard';

export type ByokPinnedFetch = typeof fetch & { dispatcher: Dispatcher };

export function createPinnedByokDispatcher(
  access: ByokOutboundAccess,
  allowPrivate: boolean,
): Dispatcher {
  const validatingLookup = createValidatingDnsLookup(access, allowPrivate);

  const lookupFn: LookupFunction = (hostname, _options, callback) => {
    void validatingLookup(hostname, { all: true, verbatim: true })
      .then((results) => {
        const first = results[0];
        if (!first) {
          const err = Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
          (callback as (error: NodeJS.ErrnoException) => void)(err);
          return;
        }
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
  const lookup = createValidatingDnsLookup(access, allowPrivate);
  const dispatcher = createPinnedByokDispatcher(access, allowPrivate);

  const pinnedFetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const href =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    await assertSafeOutboundUrl(href, { allowPrivate, lookup });
    return fetch(input, {
      ...init,
      redirect: 'manual',
      // @ts-expect-error undici dispatcher extension for Node fetch
      dispatcher,
    });
  }) as ByokPinnedFetch;

  pinnedFetch.dispatcher = dispatcher;
  return pinnedFetch;
}
