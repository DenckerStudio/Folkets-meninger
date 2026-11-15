import assert from 'node:assert/strict';
import {
  MAX_SAK_DOCUMENT_REFRESH_IDS,
  parseStortingetIssueIdsParam,
  pickIssueIdsMissingDocuments,
} from './stortinget-sak-document-backfill';

assert.equal(MAX_SAK_DOCUMENT_REFRESH_IDS, 10);

{
  const parsed = parseStortingetIssueIdsParam('200506, 200507 ,abc, ,200508');
  assert.deepEqual(parsed.valid, ['200506', '200507', '200508']);
  assert.deepEqual(parsed.invalid, ['abc']);
}

{
  const many = Array.from({ length: 15 }, (_, i) => String(200500 + i)).join(',');
  const parsed = parseStortingetIssueIdsParam(many);
  assert.equal(parsed.valid.length, 10);
  assert.equal(parsed.valid[0], '200500');
  assert.equal(parsed.valid[9], '200509');
  assert.deepEqual(parsed.invalid, []);
}

{
  const picked = pickIssueIdsMissingDocuments({
    candidateIds: ['200503', '200501', '200502', '200504'],
    issueIdsWithDocuments: new Set(['200502']),
    firstSeenAtById: new Map([
      ['200501', '2025-01-02T00:00:00.000Z'],
      ['200503', '2025-01-01T00:00:00.000Z'],
      ['200504', null],
    ]),
    limit: 2,
  });
  assert.deepEqual(picked, ['200503', '200501']);
}

{
  const picked = pickIssueIdsMissingDocuments({
    candidateIds: ['9', '10', '11'],
    issueIdsWithDocuments: new Set(),
    firstSeenAtById: new Map(),
    limit: 10,
  });
  assert.deepEqual(picked, ['10', '11', '9']);
}

console.log('stortinget-sak-document-backfill.test.ts: ok');