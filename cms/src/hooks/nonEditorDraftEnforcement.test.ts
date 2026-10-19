import assert from 'node:assert/strict';
import type { PayloadRequest } from 'payload';
import {
  applyNonEditorDraftConstraints,
  enforceDraftDataBeforeChange,
  enforceDraftDataBeforeValidate,
  enforceDraftQueryForNonEditors,
  isNonEditorContentWriter,
} from './nonEditorDraftEnforcement';

function req(role: string): PayloadRequest {
  return { user: { id: 1, role } } as unknown as PayloadRequest;
}

assert.equal(isNonEditorContentWriter(req('agent')), true);
assert.equal(isNonEditorContentWriter(req('redaktor')), false);
assert.equal(isNonEditorContentWriter(req('reader')), false);

const constrained = applyNonEditorDraftConstraints({
  _status: 'published',
  featured: true,
  publishedAt: '2026-01-01T00:00:00.000Z',
  review: { state: 'til_vurdering' },
});
assert.equal(constrained._status, 'draft');
assert.equal(constrained.featured, false);
assert.equal(constrained.publishedAt, undefined);
assert.deepEqual(constrained.review, { state: 'ny' });

const opOut = enforceDraftQueryForNonEditors({
  args: { draft: false, publishAllLocales: true, data: { title: 't' } } as never,
  operation: 'create',
  req: req('agent'),
  collection: {} as never,
  context: {},
}) as { draft?: boolean; publishAllLocales?: boolean };
assert.equal(opOut.draft, true);
assert.equal(opOut.publishAllLocales, false);

const editorOp = enforceDraftQueryForNonEditors({
  args: { draft: false, publishAllLocales: true, data: { title: 't' } } as never,
  operation: 'create',
  req: req('admin'),
  collection: {} as never,
  context: {},
}) as { draft?: boolean };
assert.equal(editorOp.draft, false);

assert.throws(
  () =>
    enforceDraftDataBeforeValidate({
      data: { _status: 'published', title: 't' },
      req: req('agent'),
      operation: 'create',
      collection: {} as never,
      context: {},
    }),
  /Agenter kan ikke publisere/,
);

const changeOut = enforceDraftDataBeforeChange({
  data: { _status: 'published' },
  req: req('agent'),
  operation: 'create',
  collection: {} as never,
  context: {},
}) as Record<string, unknown>;
assert.equal(changeOut._status, 'draft');

console.log('cms/src/hooks/nonEditorDraftEnforcement.test.ts ok');
