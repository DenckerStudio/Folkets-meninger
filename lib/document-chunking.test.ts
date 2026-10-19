import assert from 'node:assert/strict';
import {
  chunkDocument,
  chunkDocumentMarkdown,
  chunkDocumentText,
  documentContentHash,
  estimateTokens,
  looksLikeMarkdown,
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
assert.equal(pageChunks[0]?.page, 3);

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
