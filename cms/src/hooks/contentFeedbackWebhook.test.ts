import assert from 'node:assert/strict';
import type { PayloadRequest } from 'payload';
import {
  contentFeedbackAfterChange,
  contentFeedbackCaptureMainStatusBeforeChange,
  detectContentFeedbackTransition,
  isDraftOrAutosaveSave,
  queueContentFeedbackPending,
  readContentFeedbackMainStatusBefore,
  recordContentFeedbackMainStatusBefore,
  runDeferredContentFeedbackSend,
  takeAllContentFeedbackPending,
} from './contentFeedbackWebhook';
import type { ContentFeedbackWebhookBody } from '@/lib/contentFeedbackWebhook';

function req(query: Record<string, unknown> = {}): PayloadRequest {
  const calls: { id: string | number; draft?: boolean }[] = [];
  const mainById: Record<string, { _status?: string; origin?: string }> = {
    '1': { _status: 'published', origin: 'n8n' },
    '2': { _status: 'draft', origin: 'n8n' },
    '99': { _status: 'published', origin: 'n8n' },
  };

  const payload = {
    logger: { error: () => {}, warn: () => {} },
    findByID: async (args: {
      collection: string;
      id: string | number;
      draft?: boolean;
    }) => {
      calls.push({ id: args.id, draft: args.draft });
      if (args.collection !== 'posts') {
        throw new Error('not found');
      }
      const row = mainById[String(args.id)];
      if (!row) {
        throw new Error('not found');
      }
      if (args.draft === false) {
        return { id: args.id, ...row, slug: 's', title: 't', excerpt: 'e' };
      }
      return { id: args.id, ...row, slug: 's', title: 't', excerpt: 'e', _status: 'draft' };
    },
    __calls: calls,
    __setMain(id: string, status: string) {
      mainById[id] = { _status: status, origin: 'n8n' };
    },
    __deleteMain(id: string) {
      delete mainById[id];
    },
  };

  return {
    query,
    context: {},
    payload,
  } as unknown as PayloadRequest & { payload: typeof payload };
}

assert.equal(isDraftOrAutosaveSave(req({ draft: 'true' })), true);
assert.equal(isDraftOrAutosaveSave(req({ autosave: 'true' })), true);
assert.equal(isDraftOrAutosaveSave(req({})), false);

const t1 = detectContentFeedbackTransition('draft', 'published');
assert.equal(t1.becamePublished, true);
assert.equal(t1.becameArchived, false);

const t2 = detectContentFeedbackTransition('published', 'draft');
assert.equal(t2.becamePublished, false);
assert.equal(t2.becameArchived, true);

const t3 = detectContentFeedbackTransition('published', 'published');
assert.equal(t3.becamePublished, false);
assert.equal(t3.becameArchived, false);

// publish → autosave (skipped) → unpublish: snapshot main published before unpublish
async function scenarioPublishAutosaveUnpublish() {
  const r = req();
  recordContentFeedbackMainStatusBefore(r, '1', 'published');
  (r.payload as unknown as { __setMain: (id: string, s: string) => void }).__setMain('1', 'draft');

  await contentFeedbackAfterChange({
    doc: { id: 1, origin: 'n8n', slug: 'a', title: 'A', excerpt: 'x' },
    previousDoc: { id: 1, origin: 'n8n', _status: 'draft' },
    req: r,
    operation: 'update',
    collection: {} as never,
    context: r.context,
    data: {},
  });

  const pending = takeAllContentFeedbackPending(r);
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.event, 'archived');
}

await scenarioPublishAutosaveUnpublish();

// autosave alone must not queue
async function scenarioAutosaveOnly() {
  const r = req({ autosave: 'true' });
  recordContentFeedbackMainStatusBefore(r, '1', 'published');
  await contentFeedbackAfterChange({
    doc: { id: 1, origin: 'n8n', _status: 'draft' },
    previousDoc: { id: 1, origin: 'n8n', _status: 'published' },
    req: r,
    operation: 'update',
    collection: {} as never,
    context: r.context,
    data: {},
  });
  assert.equal(takeAllContentFeedbackPending(r).length, 0);
}

await scenarioAutosaveOnly();

// publish → draft edit (draft query) → republish: only first publish fires
async function scenarioRepublish() {
  const r = req();
  recordContentFeedbackMainStatusBefore(r, '1', 'draft');
  (r.payload as unknown as { __setMain: (id: string, s: string) => void }).__setMain('1', 'published');
  await contentFeedbackAfterChange({
    doc: { id: 1, origin: 'n8n' },
    previousDoc: { id: 1, origin: 'n8n', _status: 'draft' },
    req: r,
    operation: 'update',
    collection: {} as never,
    context: r.context,
    data: {},
  });
  assert.equal(takeAllContentFeedbackPending(r)[0]?.event, 'published');

  const r2 = req({ draft: 'true' });
  await contentFeedbackAfterChange({
    doc: { id: 1, origin: 'n8n', _status: 'draft' },
    previousDoc: { id: 1, origin: 'n8n', _status: 'published' },
    req: r2,
    operation: 'update',
    collection: {} as never,
    context: r2.context,
    data: {},
  });
  assert.equal(takeAllContentFeedbackPending(r2).length, 0);

  const r3 = req();
  recordContentFeedbackMainStatusBefore(r3, '1', 'published');
  (r3.payload as unknown as { __setMain: (id: string, s: string) => void }).__setMain(
    '1',
    'published',
  );
  await contentFeedbackAfterChange({
    doc: { id: 1, origin: 'n8n', _status: 'published' },
    previousDoc: { id: 1, origin: 'n8n', _status: 'draft' },
    req: r3,
    operation: 'update',
    collection: {} as never,
    context: r3.context,
    data: {},
  });
  assert.equal(takeAllContentFeedbackPending(r3).length, 0);
}

await scenarioRepublish();

// new n8n post first publish (create)
async function scenarioNewPost() {
  const r = req();
  (r.payload as unknown as { __setMain: (id: string, s: string) => void }).__setMain('2', 'published');
  await contentFeedbackAfterChange({
    doc: { id: 2, origin: 'n8n', slug: 'ny', title: 'Ny', excerpt: 'e' },
    previousDoc: undefined as never,
    req: r,
    operation: 'create',
    collection: {} as never,
    context: r.context,
    data: {},
  });
  const pending = takeAllContentFeedbackPending(r);
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.event, 'published');
  assert.equal(readContentFeedbackMainStatusBefore(r, '2', 'create'), 'draft');
}

await scenarioNewPost();

// bulk: two docs pending
{
  const r = req();
  queueContentFeedbackPending(r, 1, {
    event: 'published',
    event_id: 'a',
    post_id: '1',
    slug: '',
    title: '',
    excerpt: '',
    categories: [],
    origin: 'n8n',
    occurred_at: '',
  });
  queueContentFeedbackPending(r, 99, {
    event: 'published',
    event_id: 'b',
    post_id: '99',
    slug: '',
    title: '',
    excerpt: '',
    categories: [],
    origin: 'n8n',
    occurred_at: '',
  });
  const all = takeAllContentFeedbackPending(r);
  assert.equal(all.length, 2);
  assert.equal(takeAllContentFeedbackPending(r).length, 0);
}

// beforeChange captures published main even when saving a draft version
{
  const r = req();
  await contentFeedbackCaptureMainStatusBeforeChange({
    data: { id: 1, _status: 'draft' },
    originalDoc: { id: 1, _status: 'draft' },
    req: r,
    operation: 'update',
    collection: {} as never,
    context: r.context,
  });
  assert.equal(readContentFeedbackMainStatusBefore(r, '1', 'update'), 'published');
}

// deferred send: rollback / stale → no send
async function scenarioDeferredRollback() {
  const r = req();
  const sent: ContentFeedbackWebhookBody[] = [];
  (r.payload as unknown as { __setMain: (id: string, s: string) => void }).__setMain('1', 'draft');
  const ok = await runDeferredContentFeedbackSend(
    r.payload as never,
    {
      event: 'published',
      event_id: 'x',
      post_id: '1',
      slug: 's',
      title: 't',
      excerpt: 'e',
      categories: [],
      origin: 'n8n',
      occurred_at: new Date().toISOString(),
    },
    (body) => {
      sent.push(body);
    },
  );
  assert.equal(ok, false);
  assert.equal(sent.length, 0);

  (r.payload as unknown as { __setMain: (id: string, s: string) => void }).__setMain('1', 'published');
  const ok2 = await runDeferredContentFeedbackSend(
    r.payload as never,
    {
      event: 'published',
      event_id: 'y',
      post_id: '1',
      slug: 's',
      title: 't',
      excerpt: 'e',
      categories: [],
      origin: 'n8n',
      occurred_at: new Date().toISOString(),
    },
    (body) => {
      sent.push(body);
    },
  );
  assert.equal(ok2, true);
  assert.equal(sent.length, 1);
}

await scenarioDeferredRollback();

console.log('cms/src/hooks/contentFeedbackWebhook.test.ts ok');
