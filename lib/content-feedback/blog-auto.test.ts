import assert from 'node:assert/strict';
import { recordBlogAutoContentFeedbackWithClient } from '@/lib/content-feedback/blog-auto';

const EVENT_ID_PUBLISH = '11111111-1111-4111-8111-111111111111';
const EVENT_ID_ARCHIVE = '22222222-2222-4222-8222-222222222222';

function makeMockSupabase() {
  const seen = new Set<string>();
  return {
    client: {
      rpc(
        fn: string,
        args: {
          p_post_id: string;
          p_event: string;
          p_event_id: string;
          p_occurred_at: string;
          p_snapshot: Record<string, unknown>;
        },
      ) {
        assert.equal(fn, 'log_blog_content_feedback');
        if (seen.has(args.p_event_id)) {
          return Promise.resolve({
            data: { status: 'duplicate', id: 'row-1' },
            error: null,
          });
        }
        seen.add(args.p_event_id);
        if (args.p_event_id === EVENT_ID_PUBLISH) {
          return Promise.resolve({
            data: { status: 'inserted', id: 'row-1' },
            error: null,
          });
        }
        if (args.p_event_id === EVENT_ID_ARCHIVE) {
          return Promise.resolve({
            data: { status: 'updated', id: 'row-1' },
            error: null,
          });
        }
        return Promise.resolve({
          data: { status: 'skipped_admin', id: 'admin-row' },
          error: null,
        });
      },
    },
  };
}

const basePayload = {
  post_id: 'cms-1',
  slug: 'test-slug',
  title: 'Tittel',
  excerpt: 'Ingress',
  categories: ['Forklart'],
  origin: 'n8n',
  occurred_at: '2026-10-20T10:00:00.000Z',
};

async function run() {
  const mock = makeMockSupabase();
  const published = {
    ...basePayload,
    event: 'published' as const,
    event_id: EVENT_ID_PUBLISH,
  };

  const first = await recordBlogAutoContentFeedbackWithClient(mock.client as never, published);
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.applied, true);
    assert.equal(first.status, 'inserted');
  }

  const duplicate = await recordBlogAutoContentFeedbackWithClient(mock.client as never, published);
  assert.equal(duplicate.ok, true);
  if (duplicate.ok) {
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.applied, false);
  }

  const archived = {
    ...basePayload,
    event: 'archived' as const,
    event_id: EVENT_ID_ARCHIVE,
    occurred_at: '2026-10-20T11:00:00.000Z',
  };
  const afterArchive = await recordBlogAutoContentFeedbackWithClient(mock.client as never, archived);
  assert.equal(afterArchive.ok, true);
  if (afterArchive.ok) {
    assert.equal(afterArchive.applied, true);
    assert.equal(afterArchive.status, 'updated');
  }

  const ignored = await recordBlogAutoContentFeedbackWithClient(mock.client as never, {
    ...basePayload,
    post_id: 'cms-2',
    event: 'archived',
    event_id: '33333333-3333-4333-8333-333333333333',
  });
  assert.equal(ignored.ok, true);
  if (ignored.ok) {
    assert.equal(ignored.status, 'skipped_admin');
    assert.equal(ignored.applied, false);
  }

  console.log('content-feedback/blog-auto.test.ts: ok');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
