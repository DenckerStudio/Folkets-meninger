import assert from 'node:assert/strict';
import {
  HISTORIC_FOLK_BALLOT_ORDER,
  historicFolkBallotLabel,
} from './historic-folk-ballot-labels';

assert.deepEqual(HISTORIC_FOLK_BALLOT_ORDER, ['against', 'abstain', 'for']);
assert.equal(historicFolkBallotLabel('against'), 'Nei');
assert.equal(historicFolkBallotLabel('abstain'), 'Blank');
assert.equal(historicFolkBallotLabel('for'), 'Ja');

console.log('lib/public-aggregate/historic-folk-ballot-labels.test.ts: ok');