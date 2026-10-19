import assert from 'node:assert/strict';
import {
  isMissingHybridRpcError,
  mapHybridChunkRow,
  mergeChunks,
  primaryChunksFromHybridAttempt,
  shouldFallbackToLegacyChunks,
  type ChatDocumentChunk,
} from './rag';

async function main() {
  assert.equal(isMissingHybridRpcError({ code: 'PGRST202', message: 'x' }), true);
  assert.equal(
    isMissingHybridRpcError({ message: 'Could not find the function public.search_chunks_hybrid' }),
    true,
  );
  assert.equal(isMissingHybridRpcError({ message: 'permission denied for function search_issues_fts' }), true);
  assert.equal(isMissingHybridRpcError(null), false);
  assert.equal(isMissingHybridRpcError({ message: 'timeout' }), false);

  const mapped = mapHybridChunkRow({
    document_id: 'doc-1',
    chunk_index: 3,
    content: '  Tekst om barnehage.  ',
    document_title: 'Innstilling',
    document_kind: 'innstilling',
    source_url: 'https://www.stortinget.no/no/Saker-og-publikasjoner/',
    score_fused: 0.032,
    score_lexical: 0.12,
  });
  assert.ok(mapped);
  assert.equal(mapped!.documentId, 'doc-1');
  assert.equal(mapped!.chunkIndex, 3);
  assert.equal(mapped!.content, 'Tekst om barnehage.');
  assert.equal(mapped!.documentTitle, 'Innstilling');
  assert.equal(mapped!.sourceUrl, 'https://www.stortinget.no/no/Saker-og-publikasjoner/');
  assert.equal(mapped!.rank, 0.032);

  assert.equal(mapHybridChunkRow({ document_id: '', content: 'x' }), null);

  const a: ChatDocumentChunk = {
    documentId: 'd1',
    chunkIndex: 1,
    content: 'a',
    sourceUrl: 'https://example.com/a',
  };
  const b: ChatDocumentChunk = {
    documentId: 'd1',
    chunkIndex: 2,
    content: 'b',
    sourceUrl: 'https://example.com/b',
  };
  const merged = mergeChunks([a], [b], 4);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].sourceUrl, 'https://example.com/a');

  assert.equal(shouldFallbackToLegacyChunks(null), true);
  assert.equal(shouldFallbackToLegacyChunks([]), true);
  assert.equal(shouldFallbackToLegacyChunks([a]), false);

  let legacyCalls = 0;
  const legacy = async () => {
    legacyCalls += 1;
    return [b];
  };
  assert.deepEqual(await primaryChunksFromHybridAttempt(null, legacy), [b]);
  assert.equal(legacyCalls, 1);
  assert.deepEqual(await primaryChunksFromHybridAttempt([], legacy), [b]);
  assert.equal(legacyCalls, 2);
  assert.deepEqual(await primaryChunksFromHybridAttempt([a], legacy), [a]);
  assert.equal(legacyCalls, 2, 'legacy must not run when hybrid has chunks');

  console.log('chat/rag.hybrid.test.ts: ok');
}

void main();
