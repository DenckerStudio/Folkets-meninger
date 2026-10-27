import assert from 'node:assert/strict';
import {
  BLOG_DRAFT_SAVE_SUCCESS_MIN_MS,
  clearDraftSaveSuccess,
  isDraftSaveSuccessVisible,
  markDraftSaveSuccessVisible,
  shouldShowBlogDraftEditDisabledNote,
} from '@/lib/admin/blog-draft-edit-panel-state';

const now = 1_000_000;
const map = markDraftSaveSuccessVisible({}, 'post-1', now);
assert.equal(isDraftSaveSuccessVisible(map, 'post-1', now), true);
assert.equal(isDraftSaveSuccessVisible(map, 'post-1', now + BLOG_DRAFT_SAVE_SUCCESS_MIN_MS - 1), true);
assert.equal(isDraftSaveSuccessVisible(map, 'post-1', now + BLOG_DRAFT_SAVE_SUCCESS_MIN_MS), false);

const cleared = clearDraftSaveSuccess(map, 'post-1');
assert.equal(isDraftSaveSuccessVisible(cleared, 'post-1', now), false);
assert.deepEqual(clearDraftSaveSuccess(cleared, 'post-1'), cleared);

assert.equal(
  shouldShowBlogDraftEditDisabledNote({
    initialLoad: true,
    queue: 'pending',
    cmsConfigured: true,
    editEnabled: false,
  }),
  false,
);

assert.equal(
  shouldShowBlogDraftEditDisabledNote({
    initialLoad: false,
    queue: 'expired',
    cmsConfigured: true,
    editEnabled: false,
  }),
  false,
);

assert.equal(
  shouldShowBlogDraftEditDisabledNote({
    initialLoad: false,
    queue: 'pending',
    cmsConfigured: true,
    editEnabled: false,
  }),
  true,
);

console.log('lib/admin/blog-draft-edit-panel-state.test.ts ok');
