import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAdminContentFeedbackBody } from '@/lib/content-feedback/submit-admin-feedback';
import { validateRejectionDetail } from '@/lib/content-feedback/validation';

const routeSrc = readFileSync(
  join(process.cwd(), 'app/api/admin/content-feedback/route.ts'),
  'utf8',
);
const f1Migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261021120000_content_feedback.sql'),
  'utf8',
);

assert.match(routeSrc, /requireAdmin\(\)/);
assert.match(routeSrc, /status: auth\.status/);
assert.match(routeSrc, /parseAdminContentFeedbackBody/);
assert.match(routeSrc, /submitAdminContentFeedback/);

assert.match(f1Migration, /IF v_existing_id IS NOT NULL AND v_existing_source = 'auto' THEN/i);
assert.match(f1Migration, /source = 'admin'/i);
assert.match(f1Migration, /SET superseded_at = now\(\)/i);
assert.doesNotMatch(
  f1Migration,
  /IF v_existing_id IS NOT NULL AND v_existing_source = 'auto' THEN[\s\S]*?UPDATE public\.content_feedback[\s\S]*?WHERE id = v_existing_id;[\s\S]*?IF v_existing_id IS NOT NULL AND v_existing_source = 'admin'/i,
);

const rejectWithoutDetail = parseAdminContentFeedbackBody({
  content_type: 'reel',
  content_id: 'poll-1',
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
  content_id: 'poll-1',
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

assert.equal(
  validateRejectionDetail('reject', {}, []),
  'Ved avvisning må minst ett aspekt merkes med tommel ned eller minst én grunn velges.',
);
assert.equal(validateRejectionDetail('approve', {}, []), null);

const panelSrc = readFileSync(
  join(process.cwd(), 'components/admin/content-feedback-panel.tsx'),
  'utf8',
);
assert.match(panelSrc, /Hopp over/);
assert.match(panelSrc, /rejectionIncomplete/);
assert.match(panelSrc, /tommel ned/);
assert.match(panelSrc, /ThumbsUp/);
assert.doesNotMatch(panelSrc, /👍|👎/);

console.log('content-feedback/admin-api.test.ts: ok');
