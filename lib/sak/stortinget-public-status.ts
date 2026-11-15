import type { StortingetSakDetail } from '@/lib/stortinget';
import type { SakDocumentRef } from '@/lib/stortinget-documents';
import { SAK_DOCUMENT_KIND_LABELS } from '@/lib/stortinget-documents';
import { getSakTreatmentLabel, type SakTreatmentStatus } from '@/lib/sak-status';
import {
  getLastPastVoteEventDate,
  getNextVoteCloseDate,
  parseSaksgangEventDate,
} from '@/lib/sak-voting-window';
import { getStortingetSakUrl } from '@/lib/stortinget-horinger';

const IMPORTANT_EVENT_IDS = new Set([
  'VEDTAK',
  'VOT',
  'VOTLOV1',
  'BEHS',
  'PLBEHS',
  'INNST',
  'HOERFRIST',
  'HOER',
  'KOMITE',
  'SENDT',
  'DEBATT',
  'LOV',
]);

export type SakViktigHendelse = {
  id: string;
  label: string;
  dateIso: string | null;
  dateLabel: string | null;
};

export type SakStortingetDocumentLink = {
  id: string;
  title: string;
  kindLabel: string;
  href: string;
  external: boolean;
};

export type SakStortingetPublicStatus = {
  committee: string | null;
  treatmentLabel: string;
  decisionDateLabel: string | null;
  nextMilestoneLabel: string | null;
  stortingetSakUrl: string;
  documentLinks: SakStortingetDocumentLink[];
  keyEvents: SakViktigHendelse[];
};

function formatNbDate(date: Date): string {
  return date.toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Oslo',
  });
}

function komiteNavn(komite: StortingetSakDetail['komite']): string | null {
  if (!komite) return null;
  if (typeof komite === 'object' && typeof komite.navn === 'string' && komite.navn.trim()) {
    return komite.navn.trim();
  }
  if (typeof komite === 'string' && komite.trim()) return komite.trim();
  return null;
}

function documentTabHref(sakId: string, documentId: string): string {
  const base = `/dashboard/sak/${encodeURIComponent(sakId)}`;
  return `${base}?dokument=${encodeURIComponent(documentId)}#dokumenter`;
}

function pickDocumentLinks(
  sakId: string,
  documents: readonly SakDocumentRef[],
  max = 5,
): SakStortingetDocumentLink[] {
  const links: SakStortingetDocumentLink[] = [];
  const seen = new Set<string>();

  for (const doc of documents) {
    if (links.length >= max) break;
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    const title = doc.title?.trim() || doc.id;
    if (doc.viewable) {
      links.push({
        id: doc.id,
        title,
        kindLabel: SAK_DOCUMENT_KIND_LABELS[doc.kind],
        href: documentTabHref(sakId, doc.id),
        external: false,
      });
      continue;
    }
    const externalUrl = doc.sourceUrl?.trim();
    if (externalUrl) {
      links.push({
        id: doc.id,
        title,
        kindLabel: SAK_DOCUMENT_KIND_LABELS[doc.kind],
        href: externalUrl,
        external: true,
      });
    }
  }

  return links;
}

function eventLabelFromRaw(event: {
  id?: string | null;
  hendelse_tekst?: string | null;
}): string | null {
  const text = event.hendelse_tekst?.trim();
  if (text) return text;
  const id = event.id?.trim();
  if (!id) return null;
  const known: Record<string, string> = {
    VEDTAK: 'Vedtak',
    VOT: 'Votering',
    BEHS: 'Behandlet i Stortinget',
    PLBEHS: 'Planlagt behandling',
    INNST: 'Innstilling avgitt',
    HOER: 'Høring',
    HOERFRIST: 'Høringsfrist',
    KOMITE: 'Til komitébehandling',
    SENDT: 'Sendt til komité',
    DEBATT: 'Debatt',
    LOV: 'Lov vedtatt',
  };
  return known[id] ?? null;
}

export function extractViktigeSaksgangHendelser(
  detail: StortingetSakDetail | null | undefined,
  max = 8,
): SakViktigHendelse[] {
  const steps = detail?.saksgang?.saksgang_steg_liste ?? [];
  const collected: SakViktigHendelse[] = [];

  for (const step of steps) {
    for (const event of step.saksgang_hendelse_liste ?? []) {
      const label = eventLabelFromRaw(event);
      if (!label) continue;
      const id = event.id?.trim() || `${label}-${event.dato ?? 'ukjent'}`;
      if (!IMPORTANT_EVENT_IDS.has(id) && !event.dato) continue;

      const parsed = parseSaksgangEventDate(event.dato ?? null);
      collected.push({
        id,
        label,
        dateIso: parsed ? parsed.toISOString() : null,
        dateLabel: parsed ? formatNbDate(parsed) : null,
      });
    }
  }

  collected.sort((a, b) => {
    const at = a.dateIso ? Date.parse(a.dateIso) : 0;
    const bt = b.dateIso ? Date.parse(b.dateIso) : 0;
    if (at !== bt) return at - bt;
    return a.label.localeCompare(b.label, 'nb');
  });

  if (collected.length <= max) return collected;
  return collected.slice(-max);
}

export function buildSakStortingetPublicStatus(input: {
  sakId: string;
  detail: StortingetSakDetail | null | undefined;
  treatmentStatus: SakTreatmentStatus;
  documents: readonly SakDocumentRef[];
}): SakStortingetPublicStatus | null {
  const { sakId, detail, treatmentStatus, documents } = input;
  if (!detail && documents.length === 0) return null;

  const committee = komiteNavn(detail?.komite);
  const lastVote = getLastPastVoteEventDate(detail);
  const nextVote = getNextVoteCloseDate(detail);
  const decisionDateLabel =
    treatmentStatus === 'closed' && lastVote ? formatNbDate(lastVote) : null;
  const nextMilestoneLabel =
    treatmentStatus === 'pending' && nextVote && nextVote.getTime() > Date.now()
      ? `Planlagt: ${formatNbDate(nextVote)}`
      : null;

  const keyEvents = extractViktigeSaksgangHendelser(detail);
  const documentLinks = pickDocumentLinks(sakId, documents);

  const hasContent =
    Boolean(committee) ||
    Boolean(decisionDateLabel) ||
    Boolean(nextMilestoneLabel) ||
    documentLinks.length > 0 ||
    keyEvents.length > 0;

  if (!hasContent && !detail) return null;

  return {
    committee,
    treatmentLabel: getSakTreatmentLabel(treatmentStatus),
    decisionDateLabel,
    nextMilestoneLabel,
    stortingetSakUrl: getStortingetSakUrl(sakId),
    documentLinks,
    keyEvents,
  };
}