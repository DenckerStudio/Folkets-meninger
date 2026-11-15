import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isHearingDeadlineAlertsEnabled } from './hearing-deadline-alerts-flag';

const prevFlag = process.env.HEARING_DEADLINE_ALERTS_ENABLED;
delete process.env.HEARING_DEADLINE_ALERTS_ENABLED;
assert.equal(isHearingDeadlineAlertsEnabled(), false);

const alertsSrc = readFileSync(join(process.cwd(), 'lib/hearing-deadline-alerts.ts'), 'utf-8');
assert.match(alertsSrc, /isHearingDeadlineAlertsEnabled\(\)/);
assert.match(alertsSrc, /enabled: false/);

const utkastRoute = readFileSync(
  join(process.cwd(), 'app/api/horinger/[id]/utkast/route.ts'),
  'utf-8',
);
assert.match(utkastRoute, /requireStemmePlus/);
assert.match(utkastRoute, /checkRateLimit/);
assert.match(utkastRoute, /hearing-utkast:user/);

if (prevFlag === undefined) {
  delete process.env.HEARING_DEADLINE_ALERTS_ENABLED;
} else {
  process.env.HEARING_DEADLINE_ALERTS_ENABLED = prevFlag;
}

console.log('hearing-deadline-alerts.test.ts: ok');