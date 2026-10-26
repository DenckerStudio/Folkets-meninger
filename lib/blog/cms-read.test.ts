import assert from 'node:assert/strict';
import { isGenuinelyEmptyBlogList } from '@/lib/blog/cms-read';
import type { PayloadListResponse } from '@/lib/cms/types';

const empty: PayloadListResponse<{ id: string }> = {
  docs: [],
  totalDocs: 0,
  limit: 12,
  totalPages: 0,
  page: 1,
  pagingCounter: 0,
  hasPrevPage: false,
  hasNextPage: false,
  prevPage: null,
  nextPage: null,
};

const withPosts: PayloadListResponse<{ id: string }> = {
  ...empty,
  docs: [{ id: '1' }],
  totalDocs: 1,
};

assert.equal(isGenuinelyEmptyBlogList(null), false);
assert.equal(isGenuinelyEmptyBlogList(empty), true);
assert.equal(isGenuinelyEmptyBlogList(withPosts), false);

console.log('lib/blog/cms-read.test.ts ok');
