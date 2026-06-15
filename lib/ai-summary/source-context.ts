import { createHash } from 'crypto';
import type { StortingetSakDetail } from '@/lib/stortinget';

export type AiSummaryDocumentSource = {
  document_id?: string | null;
  title?: string | null;
  document_type?: string | null;
  text_excerpt?: string | null;
  source_url?: string | null;
};

export type AiSummarySource = {
  text: string;
  json: {
    issueId: string;
    title?: string | null;
    summary?: string | null;
    documents: AiSummaryDocumentSource[];
    detailSections: string[];
  };
  hash: string;
};

const MAX_CONTEXT_CHARS = 20_000;
const MAX_SECTION_CHARS = 4_000;

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function truncate(value: string, max = MAX_SECTION_CHARS): string {
  return value.length <= max ? value : `${value.slice(0, max)}\n[... avkortet ...]`;
}

function names(list: unknown): string | null {
  if (!Array.isArray(list)) return null;
  const out = list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as { fornavn?: string; etternavn?: string; parti?: { navn?: string } };
      const name = [row.fornavn, row.etternavn].filter(Boolean).join(' ').trim();
      return row.parti?.navn ? `${name} (${row.parti.navn})` : name;
    })
    .filter(Boolean);
  return out.length > 0 ? out.join(', ') : null;
}

function listNames(list: unknown): string | null {
  if (!Array.isArray(list)) return null;
  const out = list
    .map((item) => (typeof item === 'string' ? item : clean((item as { navn?: string })?.navn)))
    .filter(Boolean);
  return out.length > 0 ? out.join(', ') : null;
}

function timeline(detail: StortingetSakDetail | null): string | null {
  const steps = detail?.saksgang?.saksgang_steg_liste;
  if (!Array.isArray(steps)) return null;
  const lines: string[] = [];
  for (const step of steps.slice(0, 8)) {
    if (step.navn) lines.push(`- ${step.navn}`);
    for (const event of step.saksgang_hendelse_liste ?? []) {
      if (event.hendelse_tekst) lines.push(`  - ${event.hendelse_tekst}`);
    }
  }
  return lines.length > 0 ? lines.join('\n') : null;
}

function pushSection(parts: string[], label: string, value: unknown) {
  const text = clean(value);
  if (text) parts.push(`${label}:\n${truncate(text)}`);
}

export function buildAiSummarySource(args: {
  issueId: string;
  title?: string | null;
  summary?: string | null;
  detail?: StortingetSakDetail | null;
  documents?: AiSummaryDocumentSource[];
}): AiSummarySource {
  const detail = args.detail ?? null;
  const title = args.title || detail?.korttittel || detail?.tittel || `Sak ${args.issueId}`;
  const summary = args.summary || detail?.tittel || null;
  const documents = (args.documents ?? []).filter((doc) => clean(doc.text_excerpt) || clean(doc.title));
  const parts: string[] = [`Sak ID: ${args.issueId}`, `Tittel: ${title}`];

  pushSection(parts, 'Kort beskrivelse', summary);
  pushSection(parts, 'Dokumentreferanse', detail?.henvisning);
  pushSection(parts, 'Komité', typeof detail?.komite === 'string' ? detail.komite : detail?.komite?.navn);
  pushSection(parts, 'Emner', listNames(detail?.emne_liste));
  pushSection(parts, 'Stikkord', listNames(detail?.stikkord_liste));
  pushSection(parts, 'Forslagstillere', names(detail?.sak_opphav?.forslagstiller_liste));
  pushSection(parts, 'Saksordførere', names(detail?.saksordfoerer_liste));
  pushSection(parts, 'Saksgang og hendelser', timeline(detail));

  const detailSections: string[] = [];
  for (const [label, value] of [
    ['Innstillingstekst', detail?.innstillingstekst],
    ['Kortvedtak', detail?.kortvedtak],
    ['Vedtakstekst', detail?.vedtakstekst],
    ['Parentestekst', detail?.parentestekst],
  ] as const) {
    const text = clean(value);
    if (text) {
      detailSections.push(label);
      pushSection(parts, label, text);
    }
  }

  for (const doc of documents.slice(0, 5)) {
    const docTitle = clean(doc.title) || clean(doc.document_id) || 'Dokument';
    const docType = clean(doc.document_type);
    const excerpt = clean(doc.text_excerpt);
    parts.push(
      [
        `Tilhørende dokument: ${docTitle}${docType ? ` (${docType})` : ''}`,
        doc.source_url ? `Kilde: ${doc.source_url}` : null,
        excerpt ? truncate(excerpt, 3_000) : null,
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  let text = parts.filter(Boolean).join('\n\n');
  if (text.length > MAX_CONTEXT_CHARS) {
    text = `${text.slice(0, MAX_CONTEXT_CHARS)}\n\n[... avkortet ...]`;
  }

  const json = {
    issueId: args.issueId,
    title,
    summary,
    documents,
    detailSections,
  };
  const hash = createHash('sha256').update(text).digest('hex');

  return { text, json, hash };
}
