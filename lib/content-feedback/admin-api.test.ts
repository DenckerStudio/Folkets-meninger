import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAdminContentFeedbackBody } from '@/lib/content-feedback/submit-admin-feedback';
import { validateRejectionDetail } from '@/lib/content-feedback/validation';
import { sanitizeSnapshotInput } from '@/lib/content-feedback/snapshot';

const routeSrc = readFileSync(
  join(process.cwd(), 'app/api/admin/content-feedback/route.ts'),
  'utf8',
);
const serviceSrc = readFileSync(join(process.cwd(), 'lib/content-feedback/service.ts'), 'utf8');
const f1Migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261021120000_content_feedback.sql'),
  'utf8',
);

assert.match(routeSrc, /requireAdmin\(\)/);
assert.match(routeSrc, /status: auth\.status/);
assert.match(routeSrc, /parseAdminContentFeedbackBody/);
assert.match(routeSrc, /submitAdminContentFeedback/);
assert.match(routeSrc, /getAdminContentFeedback/);
assert.match(serviceSrc, /admin_submit_content_feedback/);
assert.match(serviceSrc, /buildAdminContentFeedbackSnapshot/);
assert.match(serviceSrc, /isPostgrestMissingRpcError/);
const adminRpcAt = serviceSrc.indexOf("rpc('admin_submit_content_feedback'");
const upsertRpcAt = serviceSrc.indexOf("rpc('upsert_content_feedback'");
assert.ok(adminRpcAt >= 0 && upsertRpcAt > adminRpcAt, 'upsert is only the missing-RPC fallback');

assert.match(f1Migration, /IF v_existing_id IS NOT NULL AND v_existing_source = 'auto' THEN/i);
assert.match(f1Migration, /source = 'admin'/i);
assert.match(f1Migration, /SET superseded_at = now\(\)/i);

const rejectWithoutDetail = parseAdminContentFeedbackBody({
  content_type: 'reel',
  content_id: '00000000-0000-4000-8000-000000000001',
  verdict: 'reject',
  aspects: {},
  reason_tags: [],
});
assert.equal(rejectWithoutDetail.ok, false);
if (!rejectWithoutDetail.ok) {
  assert.equal(rejectWithoutDetail.status, 400);
}

const rejectWithReason = parseAdminContentFeedbackBody({
  content_type: 'reel',
  content_id: '00000000-0000-4000-8000-000000000001',
  verdict: 'reject',
  aspects: {},
  reason_tags: ['duplikat'],
});
assert.equal(rejectWithReason.ok, true);

const rejectWithAspect = parseAdminContentFeedbackBody({
  content_type: 'ai_summary',
  content_id: '12345',
  verdict: 'reject',
  aspects: { title: '-' },
  reason_tags: [],
});
assert.equal(rejectWithAspect.ok, true);

const approveOptional = parseAdminContentFeedbackBody({
  content_type: 'ai_summary',
  content_id: '12345',
  verdict: 'approve',
  aspects: {},
  reason_tags: [],
});
assert.equal(approveOptional.ok, true);

const badType = parseAdminContentFeedbackBody({
  content_type: 'not_allowed',
  content_id: 'x',
  verdict: 'approve',
});
assert.equal(badType.ok, false);

const strictRejectsSnapshot = parseAdminContentFeedbackBody({
  content_type: 'ai_summary',
  content_id: '12345',
  verdict: 'approve',
  snapshot: { evil: true },
});
assert.equal(strictRejectsSnapshot.ok, false);

const badReelId = parseAdminContentFeedbackBody({
  content_type: 'reel',
  content_id: 'not-a-uuid',
  verdict: 'approve',
});
assert.equal(badReelId.ok, false);

const deduped = parseAdminContentFeedbackBody({
  content_type: 'blog_post',
  content_id: '42',
  verdict: 'approve',
  reason_tags: ['duplikat', 'duplikat'],
});
assert.equal(deduped.ok, true);
if (deduped.ok) {
  assert.deepEqual(deduped.body.reason_tags, ['duplikat']);
}

assert.equal(
  validateRejectionDetail('reject', {}, []),
  'Ved avvisning må minst ett aspekt merkes med tommel ned eller minst én grunn velges.',
);
assert.equal(validateRejectionDetail('approve', {}, []), null);

const sanitized = sanitizeSnapshotInput({
  title: 'OK',
  event_id: 'nope',
  occurred_at: 'nope',
  source: 'nope',
});
assert.deepEqual(sanitized, { title: 'OK' });

const panelSrc = readFileSync(
  join(process.cwd(), 'components/admin/content-feedback-panel.tsx'),
  'utf8',
);
assert.match(panelSrc, /Hopp over/);
assert.match(panelSrc, /rejectionIncomplete/);
assert.match(panelSrc, /tommel ned/);
assert.match(panelSrc, /divide-y divide-border/);
assert.match(panelSrc, /lg:grid-cols-2/);
assert.match(panelSrc, /Merk deler \(valgfritt\)/);
assert.match(panelSrc, /aria-pressed/);
assert.match(panelSrc, /min-h-11/);
assert.match(panelSrc, /tommel ned/);
assert.match(panelSrc, /ThumbsUp/);
assert.doesNotMatch(panelSrc, /neutral/);
assert.match(panelSrc, /Takk, tilbakemeldingen er lagret/);
assert.match(panelSrc, /regeneration_hint/);
assert.match(panelSrc, /json\.regeneration === false/);
assert.match(panelSrc, /AI_SUMMARY_DESCRIPTION_WITHOUT_REGEN/);
assert.match(panelSrc, /!showRegenerationHint/);
assert.match(panelSrc, /content-feedback\/capabilities/);
assert.match(panelSrc, /showAdminReviewedBadge/);
assert.match(panelSrc, /source !== 'admin'/);
assert.match(panelSrc, /Dom[\s\S]*\(påkrevd\)/);
assert.match(panelSrc, /Velg en dom/);
assert.match(panelSrc, /SAVE_CLOSE_DELAY_MS = 4000/);
assert.match(panelSrc, /SAVE_ERROR_MESSAGE/);
assert.match(panelSrc, /Kunne ikke lagre\. Prøv igjen\./);
assert.match(panelSrc, /AlertCircle/);
assert.match(panelSrc, /aria-live="polite"/);
assert.match(panelSrc, /EYEBROW_LABEL/);
assert.match(panelSrc, /minst ett av disse/);
assert.match(panelSrc, /rejectHintId/);
assert.match(panelSrc, /saveLocked/);
assert.match(panelSrc, /Merk deler/);
assert.doesNotMatch(panelSrc, /Vanlige grunner[\s\S]*\(påkrevd\)/);
assert.doesNotMatch(panelSrc, /snapshot/);
assert.doesNotMatch(panelSrc, /👍|👎/);

console.log('content-feedback/admin-api.test.ts: ok');
