import { createHash } from 'crypto';

/** ~4 Latin chars per token; good enough for Norwegian without tiktoken. */
export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.ceil(trimmed.length / 4);
}

/** Chunker id used by n8n Docling ingest (md-sections-v1). */
export const DOCUMENT_CHUNKER_ID = 'md-sections-v1';

export const DOCUMENT_CHUNK_DEFAULTS = {
  targetChars: 3500,
  overlapRatio: 0.15,
  /** Legacy plain-text window (tests / explicit override). */
  plainTextChunkSize: 1400,
  plainTextOverlap: 80,
} as const;

export type DocumentChunkMetadata = {
  issue_id: string;
  hearing_id: string | null;
  document_id: string;
  document_kind: string;
  document_title: string;
  section_title: string | null;
  page: number | null;
  page_start: number | null;
  page_end: number | null;
  source_url: string | null;
  sesjon: string | null;
  komite: string | null;
  published_at: string | null;
  content_hash: string;
};

export type StructuredDocumentChunk = {
  content: string;
  sectionTitle: string;
  page: number | null;
  pageStart: number | null;
  pageEnd: number | null;
};

const TOC_HEADING_RE = /^(innholdsfortegnelse|table of contents|contents)$/i;

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
const TABLE_ROW_RE = /^\|.+\|\s*$/;
const TABLE_SEP_RE = /^\|[\s:|-]+\|\s*$/;
const PAGE_MARKER_RE =
  /<!--\s*page(?:\s*number)?[=:\s"]*(\d+)[^>]*-->|<!--\s*page\s+(\d+)\s*-->/i;
const SIDE_MARKER_RE = /<!--\s*side\s*-->/i;
/** Dot-leader lines typical in Stortinget TOC blocks (matches n8n md-sections-v1). */
const DOT_LEADER_TOC_LINE_RE = /.+\.{2,}\s*\d+\s*$/;

function hashContent(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function looksLikeMarkdown(text: string): boolean {
  const sample = text.slice(0, 12_000);
  if (/^#{1,6}\s+/m.test(sample)) return true;
  if (/^\|.+\|\s*$/m.test(sample)) return true;
  if (PAGE_MARKER_RE.test(sample)) return true;
  if (SIDE_MARKER_RE.test(sample)) return true;
  return false;
}

export function resolveChunkPageFromMetadata(meta: {
  page?: number | null;
  page_start?: number | null;
  page_end?: number | null;
}): { page: number | null; pageStart: number | null; pageEnd: number | null } {
  const pageStart =
    meta.page_start !== undefined && meta.page_start !== null ? meta.page_start : null;
  const pageEnd = meta.page_end !== undefined && meta.page_end !== null ? meta.page_end : null;
  const page =
    meta.page !== undefined && meta.page !== null
      ? meta.page
      : pageStart !== null
        ? pageStart
        : null;
  return {
    page,
    pageStart: pageStart ?? page,
    pageEnd: pageEnd ?? pageStart ?? page,
  };
}

export function isDotLeaderTocContent(content: string): boolean {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return false;
  const dotLeaderLines = lines.filter((line) => DOT_LEADER_TOC_LINE_RE.test(line));
  return dotLeaderLines.length >= 2 && dotLeaderLines.length * 2 >= lines.length;
}

type Block = {
  text: string;
  sectionPath: string[];
  page: number | null;
  kind: 'paragraph' | 'table' | 'heading';
};

function normalizeHeadingTitle(raw: string): string {
  return raw.replace(/\s+#+\s*$/, '').trim();
}

function sectionPathLabel(path: string[]): string {
  return path.filter(Boolean).join(' › ');
}

function parsePageMarker(line: string, sideState: { count: number }): number | null {
  const trimmed = line.trim();
  if (SIDE_MARKER_RE.test(trimmed)) {
    sideState.count += 1;
    return sideState.count + 1;
  }
  const match = trimmed.match(PAGE_MARKER_RE);
  if (!match) return null;
  const num = Number(match[1] ?? match[2]);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function splitTableRows(tableText: string): { header: string; rows: string[] } {
  const lines = tableText.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { header: '', rows: [] };

  const headerLines: string[] = [];
  const dataRows: string[] = [];
  let seenSep = false;

  for (const line of lines) {
    if (!TABLE_ROW_RE.test(line)) continue;
    if (TABLE_SEP_RE.test(line)) {
      seenSep = true;
      headerLines.push(line);
      continue;
    }
    if (!seenSep && headerLines.length === 0) {
      headerLines.push(line);
      continue;
    }
    dataRows.push(line);
  }

  if (headerLines.length === 0 && lines[0]) {
    headerLines.push(lines[0]);
    dataRows.push(...lines.slice(1).filter((l) => TABLE_ROW_RE.test(l)));
  }

  return { header: headerLines.join('\n'), rows: dataRows };
}

function tableChunks(
  tableText: string,
  maxChars: number,
  sectionPath: string[],
  page: number | null,
): Block[] {
  const { header, rows } = splitTableRows(tableText);
  if (!header && rows.length === 0) {
    return [{ text: tableText.trim(), sectionPath, page, kind: 'table' }];
  }

  const headerBlock = header ? `${header}\n` : '';
  const full = `${headerBlock}${rows.join('\n')}`.trim();
  if (full.length <= maxChars) {
    return [{ text: full, sectionPath, page, kind: 'table' }];
  }

  const blocks: Block[] = [];
  let batch: string[] = [];
  let batchLen = headerBlock.length;

  const flush = () => {
    if (batch.length === 0) return;
    const body = batch.join('\n');
    const text = headerBlock ? `${headerBlock}${body}`.trim() : body.trim();
    if (text) blocks.push({ text, sectionPath, page, kind: 'table' });
    batch = [];
    batchLen = headerBlock.length;
  };

  for (const row of rows) {
    const rowLen = row.length + 1;
    if (batch.length > 0 && batchLen + rowLen > maxChars) {
      flush();
    }
    batch.push(row);
    batchLen += rowLen;
  }
  flush();

  return blocks.length > 0 ? blocks : [{ text: full.slice(0, maxChars), sectionPath, page, kind: 'table' }];
}

function isTocHeading(title: string): boolean {
  return TOC_HEADING_RE.test(title.trim());
}

function parseMarkdownBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  const headingStack: Array<{ level: number; title: string }> = [];
  let currentPage: number | null = 1;
  const sideState = { count: 0 };
  let skipToc = false;
  let tocMinLevel = 0;

  let paraLines: string[] = [];
  let tableLines: string[] = [];

  const currentPath = () => headingStack.map((h) => h.title);

  const flushParagraph = () => {
    const joined = paraLines.join('\n').trim();
    paraLines = [];
    if (!joined || skipToc) return;
    blocks.push({
      text: joined,
      sectionPath: [...currentPath()],
      page: currentPage,
      kind: 'paragraph',
    });
  };

  const flushTable = () => {
    if (tableLines.length === 0) return;
    const tableText = tableLines.join('\n');
    tableLines = [];
    if (skipToc) return;
    const parts = tableChunks(tableText, DOCUMENT_CHUNK_DEFAULTS.targetChars, currentPath(), currentPage);
    blocks.push(...parts);
  };

  for (const rawLine of lines) {
    const line = rawLine;
    const trimmed = line.trim();

    const pageNum = parsePageMarker(trimmed, sideState);
    if (pageNum !== null) {
      flushParagraph();
      flushTable();
      currentPage = pageNum;
      continue;
    }

    if (HEADING_RE.test(trimmed)) {
      flushParagraph();
      flushTable();
      const match = trimmed.match(HEADING_RE);
      if (!match) continue;
      const level = match[1].length;
      const title = normalizeHeadingTitle(match[2]);

      if (skipToc && level <= tocMinLevel) {
        skipToc = false;
      }

      if (isTocHeading(title)) {
        skipToc = true;
        tocMinLevel = level;
        while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
          headingStack.pop();
        }
        continue;
      }

      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }
      headingStack.push({ level, title });
      if (skipToc) {
        continue;
      }
      blocks.push({
        text: trimmed,
        sectionPath: [...currentPath()],
        page: currentPage,
        kind: 'heading',
      });
      continue;
    }

    if (TABLE_ROW_RE.test(trimmed)) {
      flushParagraph();
      tableLines.push(line);
      continue;
    }

    if (tableLines.length > 0) {
      flushTable();
    }

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    paraLines.push(line);
  }

  flushParagraph();
  flushTable();
  return blocks;
}

function overlapTail(text: string, overlapChars: number): string {
  if (overlapChars <= 0 || !text) return '';
  const tail = text.slice(-overlapChars);
  const paraBreak = tail.indexOf('\n\n');
  if (paraBreak >= 0 && paraBreak < tail.length - 40) {
    return tail.slice(paraBreak + 2).trimStart();
  }
  const lineBreak = tail.indexOf('\n');
  if (lineBreak >= 0 && lineBreak < tail.length - 20) {
    return tail.slice(lineBreak + 1).trimStart();
  }
  return tail.trimStart();
}

function assembleChunksFromBlocks(blocks: Block[], targetChars: number, overlapRatio: number): StructuredDocumentChunk[] {
  const overlapChars = Math.max(80, Math.floor(targetChars * overlapRatio));
  const chunks: StructuredDocumentChunk[] = [];

  let buffer = '';
  let bufferSection: string[] = [];
  let bufferPageStart: number | null = null;
  let bufferPageEnd: number | null = null;

  const emit = () => {
    const content = buffer.trim();
    buffer = '';
    if (!content) return;
    chunks.push({
      content,
      sectionTitle: sectionPathLabel(bufferSection),
      page: bufferPageStart,
      pageStart: bufferPageStart,
      pageEnd: bufferPageEnd ?? bufferPageStart,
    });
  };

  const startNewBuffer = (seed: string, sectionPath: string[], page: number | null) => {
    buffer = seed;
    bufferSection = sectionPath;
    bufferPageStart = page;
    bufferPageEnd = page;
  };

  const notePage = (page: number | null) => {
    if (page === null) return;
    if (bufferPageStart === null) bufferPageStart = page;
    bufferPageEnd = page;
  };

  for (const block of blocks) {
    const blockText = block.text.trim();
    if (!blockText) continue;

    const separator = buffer.length > 0 ? '\n\n' : '';
    const candidate = buffer + separator + blockText;

    if (
      buffer &&
      block.page !== null &&
      bufferPageEnd !== null &&
      block.page > bufferPageEnd
    ) {
      emit();
      startNewBuffer(blockText, block.sectionPath, block.page);
      continue;
    }

    if (candidate.length <= targetChars) {
      if (!buffer) {
        startNewBuffer(blockText, block.sectionPath, block.page);
      } else {
        buffer = candidate;
        bufferSection = block.sectionPath.length > 0 ? block.sectionPath : bufferSection;
        notePage(block.page);
      }
      continue;
    }

    if (buffer) {
      const previous = buffer;
      const prevPageStart: number | null = bufferPageStart;
      const prevPageEnd: number | null = bufferPageEnd;
      emit();
      const tail = overlapTail(previous, overlapChars);
      startNewBuffer(tail ? `${tail}\n\n${blockText}` : blockText, block.sectionPath, block.page);
      if (prevPageStart !== null && bufferPageStart === block.page) {
        bufferPageStart = prevPageStart;
        bufferPageEnd = block.page ?? prevPageEnd;
      }
      if (buffer.length > targetChars) {
        emit();
        startNewBuffer(blockText, block.sectionPath, block.page);
      }
      continue;
    }

    if (blockText.length > targetChars) {
      let start = 0;
      while (start < blockText.length) {
        const slice = blockText.slice(start, start + targetChars);
        chunks.push({
          content: slice.trim(),
          sectionTitle: sectionPathLabel(block.sectionPath),
          page: block.page,
          pageStart: block.page,
          pageEnd: block.page,
        });
        if (start + targetChars >= blockText.length) break;
        start += targetChars - overlapChars;
      }
      buffer = '';
      continue;
    }

    startNewBuffer(blockText, block.sectionPath, block.page);
  }

  emit();
  return chunks;
}

export function chunkDocumentMarkdown(
  text: string,
  options: { targetChars?: number; overlapRatio?: number } = {},
): StructuredDocumentChunk[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const targetChars = options.targetChars ?? DOCUMENT_CHUNK_DEFAULTS.targetChars;
  const overlapRatio = options.overlapRatio ?? DOCUMENT_CHUNK_DEFAULTS.overlapRatio;
  const blocks = parseMarkdownBlocks(normalized);
  if (blocks.length === 0) return [];

  const chunks = assembleChunksFromBlocks(blocks, targetChars, overlapRatio);
  return chunks.filter((chunk) => !isDotLeaderTocContent(chunk.content));
}

/**
 * Plain-text fallback: preserve paragraph breaks; do not collapse structure.
 */
export function chunkDocumentText(
  text: string,
  options: { chunkSize?: number; overlap?: number } = {},
): string[] {
  const chunkSize = options.chunkSize ?? DOCUMENT_CHUNK_DEFAULTS.targetChars;
  const overlap = options.overlap ?? Math.floor(chunkSize * DOCUMENT_CHUNK_DEFAULTS.overlapRatio);

  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  if (looksLikeMarkdown(normalized)) {
    return chunkDocumentMarkdown(normalized, { targetChars: chunkSize, overlapRatio: overlap / chunkSize }).map(
      (c) => c.content,
    );
  }

  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return [];

  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    const trimmed = current.trim();
    current = '';
    if (trimmed) chunks.push(trimmed);
  };

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length <= chunkSize) {
      current = next;
      continue;
    }

    if (current) flush();

    if (paragraph.length <= chunkSize) {
      current = paragraph;
      continue;
    }

    let start = 0;
    while (start < paragraph.length) {
      const end = Math.min(start + chunkSize, paragraph.length);
      let sliceEnd = end;
      if (end < paragraph.length) {
        const slice = paragraph.slice(start, end);
        const lastBreak = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
        if (lastBreak > chunkSize * 0.5) sliceEnd = start + lastBreak + 1;
      }
      const piece = paragraph.slice(start, sliceEnd).trim();
      if (piece) chunks.push(piece);
      if (sliceEnd >= paragraph.length) break;
      start = Math.max(sliceEnd - overlap, start + 1);
    }
    current = '';
  }

  flush();

  if (chunks.length <= 1) return chunks;

  const withOverlap: string[] = [chunks[0]];
  for (let i = 1; i < chunks.length; i += 1) {
    const prev = withOverlap[withOverlap.length - 1];
    const tail = overlapTail(prev, overlap);
    const merged = tail ? `${tail}\n\n${chunks[i]}` : chunks[i];
    withOverlap.push(merged.length > chunkSize * 1.35 ? chunks[i] : merged);
  }

  return withOverlap;
}

export function chunkDocument(
  text: string,
  options: { targetChars?: number; overlapRatio?: number } = {},
): StructuredDocumentChunk[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  if (looksLikeMarkdown(normalized)) {
    return chunkDocumentMarkdown(normalized, options);
  }

  const targetChars = options.targetChars ?? DOCUMENT_CHUNK_DEFAULTS.targetChars;
  const overlapRatio = options.overlapRatio ?? DOCUMENT_CHUNK_DEFAULTS.overlapRatio;
  const parts = chunkDocumentText(normalized, {
    chunkSize: targetChars,
    overlap: Math.floor(targetChars * overlapRatio),
  });

  return parts.map((content) => ({
    content,
    sectionTitle: '',
    page: null,
    pageStart: null,
    pageEnd: null,
  }));
}

export function buildDocumentChunkMetadata(args: {
  issueId: string;
  hearingId?: string | null;
  documentId: string;
  documentKind: string;
  documentTitle: string;
  sectionTitle?: string | null;
  page?: number | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  sourceUrl: string | null;
  sesjon: string | null;
  komite: string | null;
  publishedAt: string | null;
  contentHash: string;
}): DocumentChunkMetadata {
  const pages = resolveChunkPageFromMetadata({
    page: args.page ?? null,
    page_start: args.pageStart ?? null,
    page_end: args.pageEnd ?? null,
  });
  const sectionTitle =
    args.sectionTitle !== undefined && args.sectionTitle !== null
      ? args.sectionTitle.trim() || null
      : null;
  return {
    issue_id: args.issueId,
    hearing_id: args.hearingId ?? null,
    document_id: args.documentId,
    document_kind: args.documentKind,
    document_title: args.documentTitle,
    section_title: sectionTitle,
    page: pages.page,
    page_start: pages.pageStart,
    page_end: pages.pageEnd,
    source_url: args.sourceUrl,
    sesjon: args.sesjon,
    komite: args.komite,
    published_at: args.publishedAt,
    content_hash: args.contentHash,
  };
}

export function documentContentHash(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').trim().replace(/^[\uFEFF]+|[\uFEFF]+$/g, '');
  return hashContent(normalized);
}
