import assert from 'node:assert/strict';
import { recordBlogAutoContentFeedbackWithClient } from '@/lib/content-feedback/blog-auto';

type AutoRow = {
  id: string;
  content_type: string;
  content_id: string;
  verdict: string;
  source: string;
  snapshot: Record<string, unknown>;
  superseded_at: string | null;
};

function makeMockSupabase() {
  const rows: AutoRow[] = [];
  let nextId = 1;

  const findActive = (postId: string) =>
    rows.find(
      (row) =>
        row.content_type === 'blog_post' &&
        row.content_id === postId &&
        row.superseded_at === null,
    );

  return {
    rows,
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

        const existing = findActive(args.p_post_id);
        const verdict = args.p_event === 'published' ? 'approve' : 'reject';
        const snapshot = {
          ...args.p_snapshot,
          event: args.p_event,
          event_id: args.p_event_id,
          occurred_at: args.p_occurred_at,
        };

        if (existing) {
          if (existing.source !== 'auto') {
            return Promise.resolve({
              data: { status: 'skipped_admin', id: existing.id },
              error: null,
            });
          }
          if (existing.snapshot.event_id === args.p_event_id) {
            return Promise.resolve({
              data: { status: 'duplicate', id: existing.id },
              error: null,
            });
          }
          existing.verdict = verdict;
          existing.snapshot = snapshot;
          return Promise.resolve({
            data: { status: 'updated', id: existing.id },
            error: null,
          });
        }

        const id = `row-${nextId++}`;
        rows.push({
          id,
          content_type: 'blog_post',
          content_id: args.p_post_id,
          verdict,
          source: 'auto',
          snapshot,
          superseded_at: null,
        });
        return Promise.resolve({
          data: { status: 'inserted', id },
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
  const published = { ...basePayload, event: 'published' as const };

  const first = await recordBlogAutoContentFeedbackWithClient(mock.client as never, published);
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.applied, true);
    assert.equal(first.status, 'inserted');
  }
  assert.equal(mock.rows[0]?.verdict, 'approve');

  const duplicate = await recordBlogAutoContentFeedbackWithClient(mock.client as never, published);
  assert.equal(duplicate.ok, true);
  if (duplicate.ok) {
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.applied, false);
  }
  assert.equal(mock.rows.length, 1);

  const archived = {
    ...basePayload,
    event: 'archived' as const,
    occurred_at: '2026-10-20T11:00:00.000Z',
  };
  const afterArchive = await recordBlogAutoContentFeedbackWithClient(mock.client as never, archived);
  assert.equal(afterArchive.ok, true);
  if (afterArchive.ok) {
    assert.equal(afterArchive.applied, true);
    assert.equal(afterArchive.status, 'updated');
    assert.equal(afterArchive.id, mock.rows[0]?.id);
  }
  assert.equal(mock.rows.length, 1);
  assert.equal(mock.rows[0]?.verdict, 'reject');
  assert.equal(mock.rows[0]?.snapshot.event, 'archived');

  const adminMock = makeMockSupabase();
  adminMock.rows.push({
    id: 'admin-row',
    content_type: 'blog_post',
    content_id: 'cms-2',
    superseded_at: null,
    snapshot: { event_id: 'x' },
    verdict: 'approve',
    source: 'admin',
  });
  const ignored = await recordBlogAutoContentFeedbackWithClient(adminMock.client as never, {
    ...basePayload,
    post_id: 'cms-2',
    event: 'archived',
  });
  assert.equal(ignored.ok, true);
  if (ignored.ok) {
    assert.equal(ignored.status, 'skipped_admin');
    assert.equal(ignored.applied, false);
  }
  assert.equal(adminMock.rows[0]?.verdict, 'approve');

  console.log('content-feedback/blog-auto.test.ts: ok');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
