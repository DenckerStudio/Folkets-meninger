import assert from 'node:assert/strict';
import { recordBlogAutoContentFeedbackWithClient } from '@/lib/content-feedback/blog-auto';

type Row = {
  id: string;
  content_type: string;
  content_id: string;
  superseded_at: string | null;
  snapshot: Record<string, unknown>;
  verdict: string;
  source: string;
};

function makeMockSupabase() {
  const rows: Row[] = [];
  let nextId = 1;

  return {
    rows,
    client: {
      from(table: string) {
        assert.equal(table, 'content_feedback');
        const state: {
          filters: Array<(row: Row) => boolean>;
          updatePayload?: Record<string, unknown>;
        } = { filters: [] };

        const api = {
          select() {
            return api;
          },
          eq(column: string, value: string) {
            state.filters.push((row) => row[column as keyof Row] === value);
            return api;
          },
          is(column: string, value: null) {
            if (column === 'superseded_at' && value === null) {
              state.filters.push((row) => row.superseded_at === null);
            }
            return api;
          },
          maybeSingle: async () => {
            const match = rows.find((row) => state.filters.every((fn) => fn(row)));
            return { data: match ?? null, error: null };
          },
          update(payload: Record<string, unknown>) {
            state.updatePayload = payload;
            const updateApi = {
              eq(column: string, value: string) {
                state.filters.push((row) => row[column as keyof Row] === value);
                return updateApi;
              },
              select() {
                return updateApi;
              },
              maybeSingle: async () => {
                const match = rows.find((row) => state.filters.every((fn) => fn(row)));
                if (match && state.updatePayload) {
                  Object.assign(match, state.updatePayload);
                }
                return { data: match ? { id: match.id } : null, error: null };
              },
            };
            return updateApi;
          },
          insert(payload: Record<string, unknown>) {
            return {
              select() {
                return {
                  single: async () => {
                    const id = `row-${nextId++}`;
                    rows.push({
                      id,
                      content_type: String(payload.content_type),
                      content_id: String(payload.content_id),
                      superseded_at: null,
                      snapshot: payload.snapshot as Record<string, unknown>,
                      verdict: String(payload.verdict),
                      source: String(payload.source),
                    });
                    return { data: { id }, error: null };
                  },
                };
              },
            };
          },
        };
        return api;
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
    assert.equal(first.duplicate, false);
    assert.equal(first.applied, true);
  }
  assert.equal(mock.rows.length, 1);
  assert.equal(mock.rows[0]?.verdict, 'approve');

  const duplicate = await recordBlogAutoContentFeedbackWithClient(mock.client as never, published);
  assert.equal(duplicate.ok, true);
  if (duplicate.ok) {
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.applied, false);
  }
  assert.equal(mock.rows.length, 1);

  const archived = { ...basePayload, event: 'archived' as const, occurred_at: '2026-10-20T11:00:00.000Z' };
  const afterArchive = await recordBlogAutoContentFeedbackWithClient(mock.client as never, archived);
  assert.equal(afterArchive.ok, true);
  if (afterArchive.ok) {
    assert.equal(afterArchive.duplicate, false);
    assert.equal(afterArchive.applied, true);
    assert.equal(afterArchive.id, mock.rows[0]?.id);
  }
  assert.equal(mock.rows.length, 1);
  assert.equal(mock.rows[0]?.verdict, 'reject');
  assert.equal(mock.rows[0]?.snapshot.auto_event, 'archived');

  const adminMock = makeMockSupabase();
  adminMock.rows.push({
    id: 'admin-row',
    content_type: 'blog_post',
    content_id: 'cms-2',
    superseded_at: null,
    snapshot: { title: 'Admin' },
    verdict: 'approve',
    source: 'admin',
  });
  const adminPayload = { ...basePayload, post_id: 'cms-2', event: 'archived' as const };
  const ignored = await recordBlogAutoContentFeedbackWithClient(adminMock.client as never, adminPayload);
  assert.equal(ignored.ok, true);
  if (ignored.ok) {
    assert.equal(ignored.applied, false);
    assert.equal(ignored.id, 'admin-row');
  }
  assert.equal(adminMock.rows.length, 1);
  assert.equal(adminMock.rows[0]?.verdict, 'approve');
  assert.equal(adminMock.rows[0]?.source, 'admin');

  console.log('content-feedback/blog-auto.test.ts: ok');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
