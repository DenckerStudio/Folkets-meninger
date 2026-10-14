import assert from 'node:assert/strict';
import { isMissingReelDraftSchema, OpinionReelDraftUnavailableError } from './reel-draft-schema';

assert.equal(isMissingReelDraftSchema(null), false);
assert.equal(isMissingReelDraftSchema(undefined), false);
assert.equal(isMissingReelDraftSchema({ code: '', message: '' }), false);
assert.equal(isMissingReelDraftSchema({ code: '23505', message: 'duplicate key value' }), false);

assert.equal(isMissingReelDraftSchema({ code: '42703' }), true);
assert.equal(isMissingReelDraftSchema({ code: '42P01' }), true);
assert.equal(isMissingReelDraftSchema({ code: '42883' }), true);
assert.equal(isMissingReelDraftSchema({ code: 'PGRST202' }), true);
assert.equal(isMissingReelDraftSchema({ code: 'PGRST204' }), true);
assert.equal(isMissingReelDraftSchema({ code: 'PGRST205' }), true);

assert.equal(
  isMissingReelDraftSchema({
    message: 'column polls.source_opinion_id does not exist',
  }),
  true,
);
assert.equal(
  isMissingReelDraftSchema({
    message: 'Could not find the function public.create_poll_draft_from_opinion(...) in the schema cache',
  }),
  true,
);
assert.equal(
  isMissingReelDraftSchema({ message: 'function does not exist' }),
  false,
);

const err = new OpinionReelDraftUnavailableError();
assert.equal(err.name, 'OpinionReelDraftUnavailableError');
assert.ok(err instanceof Error);

console.log('reel-draft-schema tests passed');
