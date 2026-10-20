import assert from 'node:assert/strict';
import { ACCOUNT_LOCKOUT_MESSAGE_NB, PAYLOAD_USER_LOCKED_EN } from './loginMessages';
import { localizeLoginResponse } from './localizeLoginResponse';

const locked = await localizeLoginResponse(
  Response.json(
    { errors: [{ message: PAYLOAD_USER_LOCKED_EN }] },
    { status: 401 },
  ),
);
const lockedBody = (await locked.json()) as { errors: { message: string }[] };
assert.equal(lockedBody.errors[0]?.message, ACCOUNT_LOCKOUT_MESSAGE_NB);

const ok = await localizeLoginResponse(
  Response.json({ errors: [{ message: 'Feil passord' }] }, { status: 401 }),
);
const okBody = (await ok.json()) as { errors: { message: string }[] };
assert.equal(okBody.errors[0]?.message, 'Feil passord');

console.log('cms/src/lib/localizeLoginResponse.test.ts ok');
