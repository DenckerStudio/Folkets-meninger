import assert from 'node:assert/strict';
import { labelForLoginNext } from './login-next-label';

assert.strictEqual(labelForLoginNext('/dashboard/utforsk'), 'Utforsk');
assert.strictEqual(labelForLoginNext('/dashboard/avstemninger/123'), 'avstemningen');
assert.strictEqual(labelForLoginNext('/dashboard/horinger/456'), 'høringen');
assert.strictEqual(labelForLoginNext('/dashboard/folkets-meninger/012'), 'meningen');
assert.strictEqual(labelForLoginNext('/dashboard/politikere/345'), 'politikeren');
assert.strictEqual(labelForLoginNext('/dashboard/admin/678'), 'admin');
assert.strictEqual(labelForLoginNext('/dashboard?query=1'), 'dashboardet');
assert.strictEqual(labelForLoginNext('/dashboard#hash'), 'dashboardet');
assert.strictEqual(labelForLoginNext('/unknown/path'), '/unknown/path');
