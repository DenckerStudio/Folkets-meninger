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
          idFilter?: string;
        } = { filters: [] };

        const api = {
          select() {
            return api;
          },
          eq(column: string, value: string) {
            if (column === 'id') {
              state.idFilter = value;
            } else {
              state.filters.push((row) => row[column as keyof Row] === value);
            }
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
            return {
              eq: async (_column: string, value: string) => {
                const match = rows.find((row) => row.id === value);
                if (match && state.updatePayload) {
                  Object.assign(match, state.updatePayload);
                }
                return { error: null };
              },
            };
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

const payload = {
  event: 'published' as const,
  post_id: 'cms-1',
  slug: 'test-slug',
  title: 'Tittel',
  excerpt: 'Ingress',
  categories: ['Forklart'],
  origin: 'n8n',
  occurred_at: '2026-10-20T10:00:00.000Z',
};

const mock = makeMockSupabase();

async function run() {
  const first = await recordBlogAutoContentFeedbackWithClient(mock.client as never, payload);
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.duplicate, false);
  }
  assert.equal(mock.rows.length, 1);
  assert.equal(mock.rows[0]?.verdict, 'approve');

  const second = await recordBlogAutoContentFeedbackWithClient(mock.client as never, payload);
  assert.equal(second.ok, true);
  if (second.ok) {
    assert.equal(second.duplicate, true);
  }
  assert.equal(mock.rows.length, 1);

  console.log('content-feedback/blog-auto.test.ts: ok');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
