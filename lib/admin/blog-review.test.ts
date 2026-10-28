import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BLOG_DRAFT_REVIEW_LIST_QUERY,
  blogDraftReviewItemForReopen,
  mergeBlogDraftReviewItemAfterEdit,
  type BlogDraftReviewItem,
} from '@/lib/admin/blog-review';

const reviewSrc = readFileSync(join(process.cwd(), 'lib/admin/blog-review.ts'), 'utf8');
assert.match(reviewSrc, /draft:\s*true/);
assert.deepEqual(BLOG_DRAFT_REVIEW_LIST_QUERY.draft, true);

const baseRow: BlogDraftReviewItem = {
  id: 'post-1',
  slug: 'gammel-slug',
  title: 'Gammel tittel',
  excerpt: 'Gammel ingress',
  bodyMarkdown: 'Gammel brødtekst',
  reviewState: 'til_vurdering',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  expiredAt: null,
  restoredAt: null,
  payloadAdminUrl: 'https://cms.example.test/admin/collections/posts/post-1',
};

const saved = {
  id: 'post-1',
  title: 'Ny tittel',
  excerpt: 'Ny ingress',
  bodyMarkdown: 'Ny brødtekst etter lagring',
  updatedAt: '2026-02-01T12:00:00.000Z',
};

const merged = mergeBlogDraftReviewItemAfterEdit([baseRow], saved);
assert.equal(merged.length, 1);
assert.equal(merged[0]?.title, 'Ny tittel');
assert.equal(merged[0]?.bodyMarkdown, 'Ny brødtekst etter lagring');

const reopened = blogDraftReviewItemForReopen(merged, 'post-1');
assert.ok(reopened);
assert.equal(reopened.bodyMarkdown, 'Ny brødtekst etter lagring');
assert.equal(reopened.title, 'Ny tittel');

const reviewUiSrc = readFileSync(
  join(process.cwd(), 'components/admin/blog-draft-review.tsx'),
  'utf8',
);
assert.match(reviewUiSrc, /saveSuccessUntilByDraftId/);
assert.match(reviewUiSrc, /key=\{draft\.id\}/);
assert.doesNotMatch(reviewUiSrc, /updatedAt \?\? ''\}/);

const panelSrc = readFileSync(join(process.cwd(), 'components/admin/blog-draft-edit-panel.tsx'), 'utf8');
assert.match(panelSrc, /lg:hidden/);
assert.match(panelSrc, /min-h-11/);
assert.doesNotMatch(panelSrc, /setSuccess\(/);
assert.match(panelSrc, /aria-live="polite"/);
assert.match(panelSrc, /isDirty \? 'Ulagrede endringer'/);

const globalsCss = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');
assert.match(globalsCss, /--destructive-foreground:/);
assert.match(globalsCss, /--color-destructive-foreground:/);
assert.match(panelSrc, /Forkaste endringene/);
assert.match(reviewUiSrc, /Åpne i Payload/);

console.log('lib/admin/blog-review.test.ts ok');
