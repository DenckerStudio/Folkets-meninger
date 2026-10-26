/** Chunking contract for app ingest (`lib/document-chunking.ts`). n8n only embeds pre-chunked rows. */

export const DOCUMENT_CHUNKING_SPEC_LINES = [
  'Chunking skjer i appen (`lib/stortinget-document-ingest.ts` + `lib/document-chunking.ts`).',
  'Docling Markdown: del på overskrifter og avsnitt, tabeller som enheter (store tabeller deles på rader med gjentatt header).',
  'Mål: ~800–1000 tokens (~3500 tegn), 15 % overlapp, metadata.section_title = overskriftssti.',
  'Re-chunk kun når `stortinget_issue_documents.content_hash` endres; `metadata.content_hash` speiler samme hash.',
  'Etter re-chunk: kjør `POST /webhook/folkets-document-embeddings` (valgfri `stortinget_issue_id`) eller vent på timeplan.',
] as const;

export const DOCUMENT_CHUNKING_SPEC = DOCUMENT_CHUNKING_SPEC_LINES.join('\n');
