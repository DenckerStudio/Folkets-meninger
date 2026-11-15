import assert from 'node:assert/strict';
import { routes } from '@/lib/routes';
import {
  folkBelowThresholdNextStep,
  folkHistoricAggregateBelowThresholdMessage,
} from '@/lib/public-aggregate/folk-below-threshold';

assert.match(folkHistoricAggregateBelowThresholdMessage(), /historiske anonyme stemmer/);
assert.match(folkHistoricAggregateBelowThresholdMessage(), /avviklet/);

const pollStep = folkBelowThresholdNextStep('abc-123');
assert.equal(pollStep.kind, 'poll');
assert.equal(pollStep.href, routes.poll('abc-123'));
assert.match(pollStep.label, /Nei\/Blank\/Ja/);

const exploreStep = folkBelowThresholdNextStep(null);
assert.equal(exploreStep.kind, 'explore');
assert.equal(exploreStep.href, routes.utforsk);

console.log('lib/public-aggregate/folk-below-threshold.test.ts: ok');