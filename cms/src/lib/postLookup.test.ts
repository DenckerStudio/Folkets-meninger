import assert from 'node:assert/strict';
import type { Payload } from 'payload';
import { findPostBySlugOrSourceEvent } from '@/lib/postLookup';

const calls: string[] = [];

const payload = {
  find: async (args: { where: Record<string, unknown> }) => {
    if ('sourceEvent' in (args.where as { sourceEvent?: unknown })) {
      calls.push('sourceEvent');
      return { docs: [{ id: 1, slug: 'fra-event', _status: 'published' }] };
    }
    calls.push('slug');
    return { docs: [] };
  },
} as unknown as Payload;

void (async () => {
  const hit = await findPostBySlugOrSourceEvent(payload, {
    slug: 'min-slug',
    sourceEvent: 'evt-1',
  });
  assert.equal(hit?.slug, 'fra-event');
  assert.equal(hit?.cmsStatus, 'published');
  assert.deepEqual(calls, ['sourceEvent']);

  calls.length = 0;
  const miss = await findPostBySlugOrSourceEvent(payload, { slug: 'min-slug' });
  assert.equal(miss, null);
  assert.deepEqual(calls, ['slug']);

  console.log('cms/src/lib/postLookup.test.ts ok');
})();
