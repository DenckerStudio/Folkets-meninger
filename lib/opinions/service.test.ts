import assert from 'node:assert/strict';
import { OPINION_REPLY_BODY_MIN } from './types';
import { validateReplyDraft } from './validate';
import { hasOpinionFieldErrors, isOpinionStance } from './validate';

const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

assert.equal(hasServiceRoleKey, false, 'Test should run without SUPABASE_SERVICE_ROLE_KEY to avoid DB calls');

// Test validateReplyDraft with quick:true (service-level validation logic)
const quickFor = validateReplyDraft({ body: '', stance: 'for', quick: true });
assert.deepEqual(quickFor, {}, 'quick:true with empty body and for stance should pass validation');

const quickImot = validateReplyDraft({ body: '', stance: 'imot', quick: true });
assert.deepEqual(quickImot, {}, 'quick:true with empty body and imot stance should pass validation');

const quickForNoFlag = validateReplyDraft({ body: '', stance: 'for' });
assert.ok(quickForNoFlag.body, 'quick flag missing: empty body with for stance should fail');

const quickImotNoFlag = validateReplyDraft({ body: '', stance: 'imot' });
assert.ok(quickImotNoFlag.body, 'quick flag missing: empty body with imot stance should fail');

const quickForTooShort = validateReplyDraft({ body: 'for kort', stance: 'for', quick: true });
assert.ok(quickForTooShort.body, 'quick:true but body too short should fail');
assert.match(quickForTooShort.body ?? '', /80/);

const quickForOk = validateReplyDraft({ body: 'y'.repeat(OPINION_REPLY_BODY_MIN), stance: 'for', quick: true });
assert.deepEqual(quickForOk, {}, 'quick:true with sufficient body should pass');

const quickBlank = validateReplyDraft({ body: '', stance: 'blank', quick: true });
assert.deepEqual(quickBlank, {}, 'quick:true with blank stance and empty body should pass (blank has no min)');

const serviceQuickLogic = (body: string, stance: unknown, quick?: boolean) => {
  const trimmedBody = body.trim();
  const isQuick = quick === true;
  const errors = validateReplyDraft({ body: trimmedBody, stance, quick: isQuick });
  if (hasOpinionFieldErrors(errors) || !isOpinionStance(stance)) {
    return { ok: false, error: errors.body || errors.stance || 'Ugyldig svar' };
  }
  if (trimmedBody.length > 4000) {
    return { ok: false, error: 'Ugyldig begrunnelse' };
  }
  if (stance !== 'blank' && trimmedBody.length < OPINION_REPLY_BODY_MIN && !(isQuick && (stance === 'for' || stance === 'imot'))) {
    return { ok: false, error: 'Ugyldig begrunnelse' };
  }
  return { ok: true };
};

assert.equal(serviceQuickLogic('', 'for', true).ok, true, 'service logic: quick for with empty body should pass');
assert.equal(serviceQuickLogic('', 'imot', true).ok, true, 'service logic: quick imot with empty body should pass');
assert.equal(serviceQuickLogic('', 'for', false).ok, false, 'service logic: non-quick for with empty body should fail');
assert.equal(serviceQuickLogic('', 'imot', false).ok, false, 'service logic: non-quick imot with empty body should fail');
assert.equal(serviceQuickLogic('', 'blank', true).ok, true, 'service logic: quick blank with empty body should pass (blank has no min)');
assert.equal(serviceQuickLogic('x'.repeat(79), 'for', true).ok, false, 'service logic: quick for with too short body should fail');
assert.equal(serviceQuickLogic('x'.repeat(80), 'for', true).ok, true, 'service logic: quick for with min body should pass');
assert.equal(serviceQuickLogic('x'.repeat(80), 'for', false).ok, true, 'service logic: non-quick for with min body should pass');

console.log('lib/opinions/service.test.ts: ok');