import assert from 'node:assert/strict';
import {
  hearingChunkDocumentLabel,
  isMissingHearingHybridRpcError,
  type HearingChunkHit,
} from './hearing-rag';

assert.equal(isMissingHearingHybridRpcError({ code: 'PGRST202', message: 'x' }), true);
assert.equal(
  isMissingHearingHybridRpcError({ message: 'Could not find the function public.search_chunks_hybrid' }),
  true,
);
assert.equal(
  isMissingHearingHybridRpcError({ message: 'Unknown argument filter_hearing_id' }),
  true,
);
assert.equal(isMissingHearingHybridRpcError(null), false);

const hit: HearingChunkHit = {
  chunkId: '1',
  hearingId: '100',
  hearingDocumentId: 'd',
  documentId: 'd',
  chunkIndex: 0,
  content: 'tekst',
  documentTitle: 'Program',
  documentKind: 'horingsprogram',
  sourceUrl: 'https://example.com',
  rank: 0.1,
};
assert.equal(hit.hearingId, '100');
assert.equal(hearingChunkDocumentLabel({ documentTitle: null, hearingId: '' }), 'Dokument');

console.log('chat/hearing-rag.hybrid.test.ts: ok');
