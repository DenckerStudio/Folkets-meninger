import assert from 'node:assert/strict';
import {
  DOCUMENT_CHUNKER_ID,
  buildDocumentChunkMetadata,
  chunkDocument,
  chunkDocumentMarkdown,
  chunkDocumentText,
  documentContentHash,
  estimateTokens,
  isDotLeaderTocContent,
  looksLikeMarkdown,
  resolveChunkPageFromMetadata,
} from './document-chunking';

const STORTINGET_FIXTURE = `# Innstilling fra komiteen

## Komiteens merknader

Komiteen viser til proposisjonen og understreker at tiltakene må følges opp.

## Økonomiske konsekvenser

Forslaget innebærer merutgifter på om lag 120 millioner kroner i 2026.

| Post | Beløp (mill. kr) | Merknad |
| --- | ---: | --- |
| Driftsmidler | 45 | Økt bemanning |
| Investeringer | 75 | Nytt bygg |

## Vedtak

Stortinget vedtar følgende:

1. Lov om endringer i eksempelloven.
2. Endringene trer i kraft 1. januar 2027.
`;

assert.equal(DOCUMENT_CHUNKER_ID, 'md-sections-v1');
assert.ok(looksLikeMarkdown(STORTINGET_FIXTURE));

const mdChunks = chunkDocumentMarkdown(STORTINGET_FIXTURE);
assert.ok(mdChunks.length >= 1, 'expected markdown chunks for fixture');
assert.ok(
  mdChunks.some((c) => c.content.includes('Komiteens merknader')),
  'heading section preserved',
);
assert.ok(
  mdChunks.some((c) => c.content.includes('Økonomiske konsekvenser')),
  'economic section preserved',
);
assert.ok(
  mdChunks.every((c) => !c.content.includes('Komiteens merknader Økonomiske')),
  'sections should not be collapsed onto one line',
);
assert.ok(
  mdChunks.some(
    (c) =>
      c.sectionTitle.includes('Komiteens merknader') || c.content.includes('## Komiteens merknader'),
  ),
  'section_title or heading preserved',
);
assert.ok(mdChunks.some((c) => c.content.includes('| Driftsmidler |')), 'table rows kept');

for (const chunk of mdChunks) {
  assert.ok(chunk.content.includes('\n') || chunk.content.length < 200, 'paragraph breaks retained when present');
  const tokens = estimateTokens(chunk.content);
  assert.ok(tokens <= 1200, `chunk too large: ${tokens} tokens`);
}

const withPage = `# Dokument

<!-- page 3 -->

Avsnitt på side 3.

## Neste avsnitt

Mer tekst.
`;
const pageChunks = chunkDocumentMarkdown(withPage);
const pageThree = pageChunks.find((c) => c.content.includes('Avsnitt på side 3'));
assert.ok(pageThree);
assert.equal(pageThree?.pageEnd, 3);
assert.ok((pageThree?.pageStart ?? 0) <= 3);

const withSideMarkers = `# Forside

Intro på side 1.

<!-- side -->

Kapittel på side 2.

<!-- side -->

Mer på side 3.
`;
const sideOnly = chunkDocumentMarkdown('Forside\n\n<!-- side -->\n\nSide to.');
assert.equal(sideOnly.find((c) => c.content.includes('Side to.'))?.pageStart, 2);

const sideChunks = chunkDocumentMarkdown(withSideMarkers);
assert.ok(sideChunks.some((c) => c.content.includes('Kapittel på side 2')));
assert.ok(sideChunks.some((c) => c.content.includes('Mer på side 3') && (c.pageEnd ?? 0) >= 3));

assert.ok(isDotLeaderTocContent('Kapittel 1 .............. 3\nKapittel 2 .............. 7'));
assert.ok(!isDotLeaderTocContent('Vanlig avsnitt uten punktumleder.'));

const dotLeaderDoc = `# Rapport

Kapittel 1 .............. 3
Kapittel 2 .............. 7

## Innhold

Dette er ekte innhold etter innholdsfortegnelsen.
`;
const dotChunks = chunkDocumentMarkdown(dotLeaderDoc);
assert.ok(dotChunks.every((c) => !isDotLeaderTocContent(c.content)));
assert.ok(dotChunks.some((c) => c.content.includes('ekte innhold')));

const metaPages = resolveChunkPageFromMetadata({ page_start: 4, page_end: 6 });
assert.equal(metaPages.page, 4);
assert.equal(metaPages.pageEnd, 6);

const metaNullSection = buildDocumentChunkMetadata({
  issueId: '1',
  documentId: 'd',
  documentKind: 'prop',
  documentTitle: 'T',
  sectionTitle: null,
  pageStart: 2,
  pageEnd: 5,
  sourceUrl: null,
  sesjon: null,
  komite: null,
  publishedAt: null,
  contentHash: 'h',
});
assert.equal(metaNullSection.section_title, null);
assert.equal(metaNullSection.page, 2);
assert.equal(metaNullSection.page_end, 5);

const withToc = `# Rapport

## Innholdsfortegnelse

1. Kapittel en
2. Kapittel to

## Kapittel en

Dette er hovedinnholdet som skal beholdes.
`;
const tocChunks = chunkDocumentMarkdown(withToc);
assert.ok(
  tocChunks.every((c) => !c.content.includes('Kapittel en\n2. Kapittel to')),
  'TOC list entries should be dropped',
);
assert.ok(
  tocChunks.some((c) => c.content.includes('Dette er hovedinnholdet')),
  'content after TOC should remain',
);

const wideTableRows = [
  '| Kolonne A | Kolonne B |',
  '| --- | --- |',
  ...Array.from({ length: 80 }, (_, i) => `| Rad ${i + 1} | Verdi ${i + 1} med litt norsk tekst |`),
].join('\n');
const tableDoc = `# Tabell\n\n${wideTableRows}\n`;
const tableChunks = chunkDocumentMarkdown(tableDoc, { targetChars: 800 });
assert.ok(tableChunks.length > 1, 'large table splits into multiple chunks');
for (const chunk of tableChunks) {
  if (chunk.content.includes('| Rad')) {
    assert.match(chunk.content, /\| Kolonne A \| Kolonne B \|/);
    assert.match(chunk.content, /\| --- \| --- \|/);
  }
}

const longPlain = Array.from({ length: 30 }, (_, i) => `Avsnitt ${i + 1} med norsk tekst.\n\n`).join('');
const plainChunks = chunkDocumentText(longPlain, { chunkSize: 400, overlap: 60 });
assert.ok(plainChunks.length > 1);
assert.ok(plainChunks[0].includes('Avsnitt 1'));
assert.ok(plainChunks.some((c) => c.includes('\n\n') || c.includes('Avsnitt')), 'plain chunks keep paragraph spacing');

const hashA = documentContentHash('Hei\n\nVerden');
const hashB = documentContentHash('Hei\n\nVerden');
const hashC = documentContentHash('Hei Verden');
assert.equal(hashA, hashB);
assert.notEqual(hashA, hashC);

const auto = chunkDocument(STORTINGET_FIXTURE);
assert.equal(auto.length, mdChunks.length);

console.log('document-chunking.test.ts: ok');
