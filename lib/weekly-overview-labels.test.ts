import assert from 'node:assert/strict';
import { weeklyPeriodLabelMidSentence } from './weekly-overview-labels';

assert.equal(
  weeklyPeriodLabelMidSentence('Neste 7 dager (15. nov.–22. nov.)'),
  'neste 7 dager (15. nov.–22. nov.)',
);
assert.equal(
  weeklyPeriodLabelMidSentence('Siste 7 dager (8. nov.–15. nov.)'),
  'siste 7 dager (8. nov.–15. nov.)',
);
assert.equal(weeklyPeriodLabelMidSentence(''), '');

console.log('lib/weekly-overview-labels.test.ts: ok');