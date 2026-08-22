import assert from 'node:assert/strict';
import { extractMoneyMentions, formatKr } from './money';
import { retrieveRelevantChunks, scoreChunkForProfile } from './retrieve';
import { parseImpactProfile } from './profile';
import { synthesizeImpact } from './synthesize';
import type { ImpactChunk } from './types';

assert.equal(formatKr(1800), '1 800 kr');

const mentions = extractMoneyMentions(
  'Forslaget øker veibruksavgiften med 1 800 kr i året for bileiere. Studenter får 500 kr mer i støtte per måned.',
);
assert.ok(mentions.length >= 1);
assert.equal(mentions[0]?.amountKr, 1800);
assert.equal(mentions[0]?.direction, 'increase');
assert.equal(mentions[0]?.kind, 'fee');

const monthly = extractMoneyMentions('Studenter får 500 kr mer i støtte per måned.');
assert.equal(monthly[0]?.amountKr, 6000);
assert.equal(monthly[0]?.kind, 'benefit');

const noBareNumber = extractMoneyMentions('Saken har nummer 12345 og ble fremmet i 2025.');
assert.equal(noBareNumber.length, 0);

const chunks: ImpactChunk[] = [
  {
    documentId: 'a',
    chunkIndex: 0,
    content: 'Komiteen viser til at saken gjelder intern saksbehandling i departementet.',
  },
  {
    documentId: 'b',
    chunkIndex: 1,
    content:
      'Bileiere får økt veibruksavgift på 1 800 kr i året. Leietakere berøres ikke av eiendomsskatten.',
  },
];

const carProfile = parseImpactProfile({
  fylkeCode: '03',
  housing: 'renter',
  hasCar: 'yes',
  occupation: 'employed',
});
assert.equal(carProfile.fylkeCode, '03');

const scored = retrieveRelevantChunks(chunks, carProfile, 2);
assert.equal(scored[0]?.documentId, 'b');
assert.ok((scored[0]?.score ?? 0) > scoreChunkForProfile(chunks[0].content, carProfile));

const result = synthesizeImpact({
  profile: carProfile,
  chunks,
  summary: {
    version: 2,
    narrative: 'Saken øker avgifter på bilbruk.',
    who_affected: 'Bileiere og yrkesaktive.',
    how_affected: 'Økt veibruksavgift.',
    topic_cards: [],
    labels: ['Samferdsel'],
  },
});

assert.match(result.headline, /1 800 kr/);
assert.match(result.headline, /mer i avgifter/);
assert.equal(result.annualAmountKr, 1800);
assert.equal(result.direction, 'increase');
assert.equal(result.confidence, 'high');
assert.ok(result.effects.some((e) => e.appliesToUser && e.annualAmountKr === 1800));

const noCar = synthesizeImpact({
  profile: parseImpactProfile({ hasCar: 'no', occupation: 'student' }),
  chunks,
  summary: {
    version: 2,
    narrative: 'Saken øker avgifter på bilbruk.',
    who_affected: 'Bileiere.',
    how_affected: 'Økt veibruksavgift.',
    topic_cards: [],
    labels: [],
  },
});
assert.notEqual(noCar.annualAmountKr, 1800);

console.log('impact tests passed');
