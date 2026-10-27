import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const previewSrc = readFileSync(
  join(process.cwd(), 'components/admin/reel-content-preview.tsx'),
  'utf8',
);
const reviewSrc = readFileSync(
  join(process.cwd(), 'components/admin/reel-draft-review.tsx'),
  'utf8',
);
const panelSrc = readFileSync(
  join(process.cwd(), 'components/admin/content-feedback-panel.tsx'),
  'utf8',
);
const reelsSrc = readFileSync(
  join(process.cwd(), 'app/dashboard/admin/reels/admin-reels-client.tsx'),
  'utf8',
);
const vurderSrc = readFileSync(
  join(process.cwd(), 'app/dashboard/admin/vurder/admin-vurder-client.tsx'),
  'utf8',
);

assert.match(previewSrc, /Tittel/);
assert.match(previewSrc, /Beskrivelse/);
assert.match(previewSrc, /Kilder/);
assert.match(previewSrc, /neutralSummary/);
assert.match(previewSrc, /listReelPollSourceLinks/);
assert.match(reviewSrc, /preview=\{<ReelContentPreview poll=\{reviewed\.poll\} \/>\}/);
assert.match(reviewSrc, /setReviewed\(\{/);
assert.match(panelSrc, /preview \? title : \(contentSubjectTitle \?\? title\)/);
assert.match(panelSrc, /\{preview\}/);
assert.doesNotMatch(reelsSrc, /ContentFeedbackPanel/);
assert.doesNotMatch(reelsSrc, /patchPoll/);
assert.match(vurderSrc, /ReelDraftReview/);
assert.match(vurderSrc, /BlogDraftReview/);
assert.match(vurderSrc, /AiSummaryReview/);
assert.match(vurderSrc, /role="tablist"/);
assert.match(reviewSrc, /DraftReviewQueueToggle/);
assert.match(reviewSrc, /DraftExpiryBadge/);
assert.match(reviewSrc, /Gjenopprett/);

const blogReviewSrc = readFileSync(
  join(process.cwd(), 'components/admin/blog-draft-review.tsx'),
  'utf8',
);
assert.match(blogReviewSrc, /DraftReviewQueueToggle/);
assert.match(blogReviewSrc, /Utløpte/);

const queueToggleSrc = readFileSync(
  join(process.cwd(), 'components/admin/draft-review-queue-toggle.tsx'),
  'utf8',
);
const badgeSrc = readFileSync(
  join(process.cwd(), 'components/admin/draft-expiry-badge.tsx'),
  'utf8',
);
assert.match(queueToggleSrc, /aria-pressed=\{selected\}/);
assert.doesNotMatch(queueToggleSrc, /role="tab"/);
assert.doesNotMatch(queueToggleSrc, /role="tablist"/);
assert.doesNotMatch(badgeSrc, /min-h-\[2\.75rem\]/);
assert.match(badgeSrc, /rounded-full/);

console.log('admin/reel-review-ui.test.ts: ok');
