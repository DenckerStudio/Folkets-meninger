import { createHash } from 'node:crypto';
import {
  getHoringInnspillDeadline,
  getHoringSkriftligInnspillUrl,
  getHoringStartDate,
  getHoringStatusKind,
  getHoringTitle,
  parseStortingetDate,
  type StortingetHoring,
} from '@/lib/stortinget-horinger';

export type StortingetHoringsprogram = {
  horing_id?: number;
  horingsprogram_liste?: HoringsprogramEntry[];
};

type HoringsprogramEntry = {
  tittel?: string;
  tekst?: string;
  innledning?: string;
  merknad?: string;
  sted?: string;
  rom_id?: string;
  horingsprogram_element_liste?: Array<{
    rekkefolge_nummer?: number;
    tekst?: string;
    tidsangivelse?: string;
  }>;
};

export type HearingDocumentDraft = {
  externalKey: string;
  title: string;
  kind: string;
  sourceUrl: string | null;
  markdown: string | null;
  status: 'pending' | 'converted';
  contentHash: string;
};

function defaultSesjon(): string | null {
  const value =
    process.env.STORTINGET_SESSION_ID?.trim() ||
    process.env.NEXT_PUBLIC_STORTINGET_SESSION_ID?.trim() ||
    null;
  return value;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function getStortingetHoringPageUrl(hearingId: string): string {
  return `https://www.stortinget.no/no/Hva-skjer-pa-Stortinget/Horing/?p=${encodeURIComponent(hearingId)}`;
}

export function getHoringsprogramApiUrl(hearingId: string): string {
  return `https://data.stortinget.no/eksport/horingsprogram?horingid=${encodeURIComponent(hearingId)}&format=json`;
}

export function buildHoringsprogramMarkdown(program: HoringsprogramEntry): string {
  const lines: string[] = [];
  const title = program.tittel?.trim();
  if (title) lines.push(`# ${title}`);
  const tekst = program.tekst?.trim();
  if (tekst) lines.push(tekst);
  const innledning = program.innledning?.trim();
  if (innledning) {
    lines.push('');
    lines.push(innledning);
  }
  const sted = program.sted?.trim();
  if (sted) {
    lines.push('');
    lines.push(`Sted: ${sted}`);
  }
  const elements = [...(program.horingsprogram_element_liste ?? [])].sort(
    (a, b) => (a.rekkefolge_nummer ?? 0) - (b.rekkefolge_nummer ?? 0),
  );
  if (elements.length > 0) {
    lines.push('');
    lines.push('## Program');
    for (const element of elements) {
      const label = element.tekst?.trim();
      if (!label) continue;
      const time = element.tidsangivelse?.trim();
      lines.push(time ? `- ${label} (${time})` : `- ${label}`);
    }
  }
  const merknad = program.merknad?.trim();
  if (merknad) {
    lines.push('');
    lines.push(merknad);
  }
  return lines.join('\n').trim();
}

export function hearingDocumentsFromExport(
  hearing: StortingetHoring,
  program: StortingetHoringsprogram | null,
): HearingDocumentDraft[] {
  const hearingId = String(hearing.id);
  const docs: HearingDocumentDraft[] = [];

  const programs = program?.horingsprogram_liste ?? [];
  for (const [index, entry] of programs.entries()) {
    const markdown = buildHoringsprogramMarkdown(entry);
    if (!markdown) continue;
    const title = entry.tittel?.trim() || `Høringsprogram ${index + 1}`;
    const externalKey = `horingsprogram:${index}`;
    docs.push({
      externalKey,
      title,
      kind: 'horingsprogram',
      sourceUrl: getHoringsprogramApiUrl(hearingId),
      markdown,
      status: 'converted',
      contentHash: sha256(markdown),
    });
  }

  const seenPub = new Set<string>();
  for (const sak of hearing.horing_sak_info_liste ?? []) {
    const pub = sak.sak_publikasjon?.trim();
    if (!pub) continue;
    const normalized = pub.startsWith('//') ? `https:${pub}` : pub;
    if (seenPub.has(normalized)) continue;
    seenPub.add(normalized);
    const title =
      sak.sak_henvisning?.trim() ||
      sak.sak_korttittel?.trim() ||
      sak.sak_tittel?.trim() ||
      'Sakspublikasjon';
    docs.push({
      externalKey: `sak_publikasjon:${sha256(normalized).slice(0, 16)}`,
      title,
      kind: 'sak_publikasjon',
      sourceUrl: normalized,
      markdown: null,
      status: 'pending',
      contentHash: sha256(normalized),
    });
  }

  return docs;
}

export function mapHearingToDbRow(hearing: StortingetHoring, nowIso: string) {
  const id = String(hearing.id);
  const relatedIssueIds = (hearing.horing_sak_info_liste ?? [])
    .map((sak) => (sak.sak_id != null ? String(sak.sak_id) : ''))
    .filter((value) => value.length > 0);
  const tema =
    hearing.horing_sak_info_liste?.[0]?.sak_korttittel?.trim() ||
    hearing.horing_sak_info_liste?.[0]?.sak_tittel?.trim() ||
    null;

  return {
    id,
    sesjon: defaultSesjon(),
    komite_id: hearing.komite?.id?.trim() || null,
    komite_navn: hearing.komite?.navn?.trim() || null,
    tittel: getHoringTitle(hearing),
    tema,
    horing_status: hearing.horing_status?.trim() || null,
    status_kind: getHoringStatusKind(hearing),
    innspillsfrist: getHoringInnspillDeadline(hearing)?.toISOString() ?? null,
    anmodningsfrist: parseStortingetDate(hearing.anmodningsfrist_dato_tid)?.toISOString() ?? null,
    soknadfrist: parseStortingetDate(hearing.soknadfrist_dato)?.toISOString() ?? null,
    start_dato: getHoringStartDate(hearing)?.toISOString() ?? null,
    skriftlig: Boolean(hearing.skriftlig),
    skriftlig_innspill_url: getHoringSkriftligInnspillUrl(hearing),
    related_issue_ids: relatedIssueIds,
    detail_json: hearing,
    last_synced_at: nowIso,
  };
}
