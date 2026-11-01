import assert from 'node:assert/strict';
import { DEFAULT_SITE_URL } from '@/lib/seo/metadata';
import { resolveClientShareOrigin } from '@/lib/share/client-origin';

const prevApp = process.env.NEXT_PUBLIC_APP_URL;
const prevSite = process.env.NEXT_PUBLIC_SITE_URL;

try {
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(resolveClientShareOrigin(), DEFAULT_SITE_URL, 'SSR falls back to production origin');
} finally {
  if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = prevApp;
  if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
}

console.log('client share origin: ok');
