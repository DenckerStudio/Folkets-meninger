import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OM_PROCESS_STEPS, OM_WHY_POINTS } from '@/lib/landing/om-content';

const stemmePoint = OM_WHY_POINTS.find((step) => step.title === 'Si din mening');
assert.ok(stemmePoint, 'OM_WHY_POINTS should include Si din mening');
assert.match(stemmePoint!.body, /stemme nei, blank eller ja i avstemninger/);
assert.doesNotMatch(stemmePoint!.body, /Ja, Nei eller Blank/);

const avstemningerStep = OM_PROCESS_STEPS.find((step) => step.title === 'Avstemninger');
assert.ok(avstemningerStep, 'OM_PROCESS_STEPS should include Avstemninger');
assert.doesNotMatch(avstemningerStep!.title, /Reels/i);
assert.doesNotMatch(avstemningerStep!.body, /Reels/i);
assert.match(avstemningerStep!.body, /Nei, Blank og Ja/);

const serializedSteps = JSON.stringify(OM_PROCESS_STEPS);
assert.doesNotMatch(serializedSteps, /Reels/i);

const landingAbout = readFileSync(join(process.cwd(), 'components/landing-about.tsx'), 'utf8');
assert.doesNotMatch(landingAbout, /system-Reels/);
assert.doesNotMatch(landingAbout, /includes\('Reels'\)/);

console.log('landing/om-content.test.ts: ok homepage copy uten Reels');
