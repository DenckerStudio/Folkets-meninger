import assert from 'node:assert/strict';
import {
  MAX_SAK_DOCUMENT_REFRESH_IDS,
  buildDocumentBackfillSelection,
  chunkIssueIds,
  collectIssueIdsWithoutCachedDocumentRefs,
  issueCachedDetailExcludesDocumentBackfill,
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

assert.equal(issueCachedDetailExcludesDocumentBackfill(null), false);
assert.equal(
  issueCachedDetailExcludesDocumentBackfill({ publikasjon_referanse_liste: [] }),
  true,
);
assert.equal(
  issueCachedDetailExcludesDocumentBackfill({
    publikasjon_referanse_liste: [{ lenke_tekst: 'Prop. 1', eksport_id: 'prop-1' }],
  }),
  false,
);

{
  const noRefs = collectIssueIdsWithoutCachedDocumentRefs([
    { id: '200501', detail_json: { publikasjon_referanse_liste: [] } },
    {
      id: '200502',
      detail_json: { publikasjon_referanse_liste: [{ lenke_tekst: 'Innst.', eksport_id: 'inns-1' }] },
    },
    { id: '200503', detail_json: null },
  ]);
  assert.deepEqual([...noRefs].sort(), ['200501']);
}

{
  const emptyDetailRows = Array.from({ length: 10 }, (_, i) => ({
    id: String(200510 + i),
    detail_json: { publikasjon_referanse_liste: [] },
  }));
  const withRefsRows = [
    { id: '200520', detail_json: { publikasjon_referanse_liste: [{ lenke_tekst: 'Prop.', eksport_id: 'p1' }] } },
    { id: '200521', detail_json: { publikasjon_referanse_liste: [{ lenke_tekst: 'Prop.', eksport_id: 'p2' }] } },
  ];
  const excluded = collectIssueIdsWithoutCachedDocumentRefs([...emptyDetailRows, ...withRefsRows]);
  const firstSeen = new Map(
    [...emptyDetailRows, ...withRefsRows].map((row, index) => [
      row.id,
      `2025-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
    ]),
  );
  const picked = pickIssueIdsMissingDocuments({
    candidateIds: [...emptyDetailRows, ...withRefsRows].map((row) => row.id),
    issueIdsWithDocuments: new Set(),
    issueIdsWithoutCachedDocumentRefs: excluded,
    firstSeenAtById: firstSeen,
    limit: 10,
    rotationOffset: 0,
  });
  assert.deepEqual(picked, ['200520', '200521']);
}

{
  const chunks = chunkIssueIds(Array.from({ length: 250 }, (_, i) => String(i)), 100);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0]?.length, 100);
  assert.equal(chunks[2]?.length, 50);
}

{
  const sortedIds = Array.from({ length: 20 }, (_, i) => String(200600 + i));
  const firstSeen = new Map(sortedIds.map((id, index) => [id, `2025-02-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`]));
  const day0 = pickIssueIdsMissingDocuments({
    candidateIds: sortedIds,
    issueIdsWithDocuments: new Set(),
    firstSeenAtById: firstSeen,
    limit: 10,
    rotationOffset: 0,
  });
  const day5 = pickIssueIdsMissingDocuments({
    candidateIds: sortedIds,
    issueIdsWithDocuments: new Set(),
    firstSeenAtById: firstSeen,
    limit: 10,
    rotationOffset: 5,
  });
  assert.notDeepEqual(day0, day5);
  assert.equal(day0[0], '200600');
  assert.equal(day5[0], '200605');
}

{
  const selection = buildDocumentBackfillSelection({
    candidateIds: ['200501', '200502', '200503'],
    issueIdsWithDocuments: new Set(['200502']),
    issueIdsWithoutCachedDocumentRefs: new Set(['200503']),
    firstSeenAtById: new Map([['200501', '2025-01-01T00:00:00.000Z']]),
    limit: 5,
  });
  assert.deepEqual(selection.issueIds, ['200501']);
  assert.equal(selection.skippedWithDocuments, 1);
  assert.equal(selection.skippedNoCachedDocumentRefs, 1);
}

console.log('stortinget-sak-document-backfill.test.ts: ok');