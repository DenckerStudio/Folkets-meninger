import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { User } from '@supabase/supabase-js';
import { getUserWithTimeout } from './supabase-middleware';

type VerificationResult = { data: { user: User | null } };

function fakeAuthClient(getUser: () => Promise<VerificationResult>) {
  return { auth: { getUser } };
}

async function testVerificationOutcomes() {
  const verifiedUser = { id: 'verified-user' } as User;

  assert.equal(
    await getUserWithTimeout(
      fakeAuthClient(async () => ({ data: { user: verifiedUser } })),
    ),
    verifiedUser,
  );
  assert.equal(
    await getUserWithTimeout(
      fakeAuthClient(async () => {
        throw new Error('verification failed');
      }),
    ),
    null,
  );
  assert.equal(
    await getUserWithTimeout(
      fakeAuthClient(() => new Promise<VerificationResult>(() => undefined)),
    ),
    null,
  );
}

const middlewareSource = readFileSync(
  new URL('./supabase-middleware.ts', import.meta.url),
  'utf8',
);
const authorizationHelper = middlewareSource.match(
  /(?:export )?async function getUserWithTimeout[\s\S]*?\n}\n\nexport async function refreshSessionCookies/,
)?.[0];

assert.ok(authorizationHelper, 'authorization helper must be present');
assert.doesNotMatch(
  authorizationHelper,
  /auth\.getSession\(/,
  'authorization helper must not fall back to a cookie-derived session',
);

void testVerificationOutcomes().then(() => {
  console.log('supabase-middleware.test.ts: ok');
});
