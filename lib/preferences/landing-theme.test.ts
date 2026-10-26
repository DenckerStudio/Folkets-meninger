import assert from 'node:assert/strict';
import { isLandingPath } from '@/lib/preferences/landing-theme';

assert.equal(isLandingPath('/'), true);
assert.equal(isLandingPath('/innspill'), true);
assert.equal(isLandingPath('/blogg'), true);
assert.equal(isLandingPath('/blogg/eksempel'), true);
assert.equal(isLandingPath('/blogg/tema/demokrati'), true);
assert.equal(isLandingPath('/dashboard'), false);

console.log('preferences/landing-theme.test.ts: ok');
