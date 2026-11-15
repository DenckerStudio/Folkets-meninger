import assert from 'node:assert/strict';
import {
  HISTORIC_FOLK_BALLOT_ORDER,
  historicFolkBallotLabel,
} from './historic-folk-ballot-labels';
import { historicFolkPercents } from './historic-folk-percents';

assert.deepEqual(HISTORIC_FOLK_BALLOT_ORDER, ['against', 'abstain', 'for']);
assert.equal(historicFolkBallotLabel('against'), 'Nei');
assert.equal(historicFolkBallotLabel('abstain'), 'Blank');
assert.equal(historicFolkBallotLabel('for'), 'Ja');

{
  const p = historicFolkPercents({ against: 1, abstain: 1, for: 1 });
  assert.equal(p.against + p.abstain + p.for, 100);
}

console.log('lib/public-aggregate/historic-folk-ballot-labels.test.ts: ok');
