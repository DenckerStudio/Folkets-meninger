import assert from 'node:assert/strict';
import type { Payload } from 'payload';
import { findPostBySlugOrSourceEvent, findPostsBySourceEventPrefix } from '@/lib/postLookup';

const calls: string[] = [];

const payload = {
  find: async (args: { where: Record<string, unknown>; sort?: string }) => {
    if ('sourceEvent' in (args.where as { sourceEvent?: unknown })) {
      const where = args.where as { sourceEvent?: { like?: string; equals?: string } };
      if (where.sourceEvent?.like) {
        calls.push(`prefix:${where.sourceEvent.like}`);
        return {
          docs: [
            {
              id: 2,
              slug: 'nyest',
              _status: 'draft',
              sourceEvent: 'research_topic:abc:var',
              updatedAt: '2026-11-03T13:00:00.000Z',
            },
            {
              id: 1,
              slug: 'eldre',
              _status: 'draft',
              sourceEvent: 'research_topic:abc',
              updatedAt: '2026-11-03T12:00:00.000Z',
            },
          ],
        };
      }
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

  calls.length = 0;
  const listed = await findPostsBySourceEventPrefix(payload, 'research_topic:abc');
  assert.equal(listed.length, 2);
  assert.equal(listed[0]?.slug, 'nyest');
  assert.match(calls[0] ?? '', /^prefix:/);

  console.log('cms/src/lib/postLookup.test.ts ok');
})();
