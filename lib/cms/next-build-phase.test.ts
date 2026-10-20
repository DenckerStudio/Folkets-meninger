import assert from 'node:assert/strict';
import { isNextProductionBuildPhase } from '@/lib/cms/next-build-phase';

const snapshot = process.env.NEXT_PHASE;

function restore() {
  if (snapshot === undefined) delete process.env.NEXT_PHASE;
  else process.env.NEXT_PHASE = snapshot;
}

delete process.env.NEXT_PHASE;
assert.equal(isNextProductionBuildPhase(), false);

process.env.NEXT_PHASE = 'phase-production-build';
assert.equal(isNextProductionBuildPhase(), true);

restore();
console.log('lib/cms/next-build-phase.test.ts ok');
