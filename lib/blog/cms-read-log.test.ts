import assert from 'node:assert/strict';
import { logBloggCmsReadFailure } from '@/lib/blog/cms-read-log';

const originalError = console.error;
let lastArgs: unknown[] | null = null;

console.error = (...args: unknown[]) => {
  lastArgs = args;
};

logBloggCmsReadFailure('featured', new Error('CMS returnerte HTTP 503?token=secret'));
assert.ok(lastArgs);
assert.equal(lastArgs[0], '[blogg] CMS-lesing feilet');
const payload = lastArgs[1] as { message: string; del: string; stack?: string };
assert.equal(payload.del, 'featured');
assert.equal(payload.message, 'CMS returnerte HTTP 503');
assert.ok(payload.stack?.includes('Error'));

console.error = originalError;

console.log('lib/blog/cms-read-log.test.ts ok');