import { getPolitikereOversikt, getSakDetail, type PolitikerOversikt, type StortingetSakDetail } from '@/lib/stortinget';
import {
  STORTINGET_MIN_DATE_MS,
  fetchStortingetHoringer,
  findHoringerForSak,
  formatDateNb,
  formatHoringDeadlineSummary,
  getHoringInnspillDeadline,
  getHoringSkriftligInnspillUrl,
  getHoringStartDate,
  getHoringStatusKind,
  getHoringStatusLabel,
  getHoringSubtitle,
  getHoringTitle,
  sortHoringer,
  summarizeHoringer,
  type HoringStatusKind,
  type StortingetHoring,
} from '@/lib/stortinget-horinger';
import { groupSakDocumentsByKind, parseSakDocuments } from '@/lib/stortinget-documents';
import { formatVotingDaysLeftLabel, getSakVotingWindow } from '@/lib/sak-voting-window';
import { getSakTreatmentLabel, resolveSakStatusFromSources } from '@/lib/sak-status';

export type ChatHearing = {
  id: string;
  title: string;
  subtitle: string | null;
  statusKind: HoringStatusKind;
  statusLabel: string;
  deadline: string | null;
  deadlineLabel: string;
  startDate: string | null;
  committee: string | null;
  skriftligInnspillUrl: string | null;
};

/** Pure shape for one Stortinget hearing, honest about missing dates/committees. */
export function shapeChatHearing(hearing: StortingetHoring): ChatHearing {
  const deadline = getHoringInnspillDeadline(hearing);
  const start = getHoringStartDate(hearing);
  return {
    id: String(hearing.id),
    title: getHoringTitle(hearing),
    subtitle: getHoringSubtitle(hearing),
    statusKind: getHoringStatusKind(hearing),
    statusLabel: getHoringStatusLabel(hearing),
    deadline: deadline ? deadline.toISOString() : null,
    deadlineLabel: formatHoringDeadlineSummary(hearing),
    startDate: start ? start.toISOString() : null,
    committee: hearing.komite?.navn ?? null,
    skriftligInnspillUrl: getHoringSkriftligInnspillUrl(hearing),
  };
}

export type ChatHearingSearch = {
  hearings: ChatHearing[];
  summary: ReturnType<typeof summarizeHoringer>;
};

/**
 * Saksgang event ids that mark a hearing (same labels the sak page timeline
 * renders). HOER is the hearing itself, HOERFRIST its written-submission
 * deadline. Text may also carry «høring» when the id is unset.
 */
const SAKSGANG_HOERING_EVENTS = new Set(['HOER', 'HOERFRIST']);

function isSaksgangHearingEvent(id: string | undefined, text: string | null | undefined): boolean {
  if (id && SAKSGANG_HOERING_EVENTS.has(id)) return true;
  return Boolean(text && /høring/i.test(text));
}

/** Parse a saksgang event date (`23.04.2025 00:00:00` or `/Date(...)/`). */
export function parseSaksgangEventDate(raw: string | null | undefined): Date | null {
  if (!raw?.trim() || raw.startsWith('01.01.0001')) return null;

  const dotnet = raw.match(/\/Date\((-?\d+)(?:[+-]\d+)?\)\//);
  if (dotnet) {
    const ms = Number.parseInt(dotnet[1], 10);
    if (Number.isNaN(ms) || ms <= STORTINGET_MIN_DATE_MS) return null;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parts = raw.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (parts) {
    const date = new Date(
      Date.UTC(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1])),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Extract hearings from the sak detail's own saksgang — the same source as the
 * Saksgang timeline on the sak page. The Stortinget `horinger` export only
 * covers current hearings and often omits finished ones, so a sak that clearly
 * had a hearing in its saksgang (e.g. HOER/HOERFRIST events) must still surface
 * here. These entries have no public hearing id/url, so `skriftligInnspillUrl`
 * stays null; the underlying export-linked hearing wins when both exist.
 */
export function hearingsFromSaksgang(detail: StortingetSakDetail): ChatHearing[] {
  const steps = detail.saksgang?.saksgang_steg_liste ?? [];
  const title = detail.korttittel?.trim() || detail.tittel?.trim() || `Sak ${detail.id}`;
  const committee =
    typeof detail.komite === 'string' ? detail.komite : detail.komite?.navn ?? null;

  const hearings: ChatHearing[] = [];

  for (const step of steps) {
    const events = step.saksgang_hendelse_liste ?? [];
    const hoerEvents = events
      .filter((event) => isSaksgangHearingEvent(event.id, event.hendelse_tekst))
      .map((event) => ({
        event,
        date: parseSaksgangEventDate(event.dato),
        isFrist: event.id === 'HOERFRIST',
      }))
      .filter((entry) => entry.date != null);

    const hoer = hoerEvents.filter((entry) => !entry.isFrist);
    const frister = hoerEvents.filter((entry) => entry.isFrist);

    for (const event of hoer) {
      const deadline =
        frister.find((frist) => frist.date!.getTime() >= event.date!.getTime())?.date ?? null;
      const date = event.date!;
      hearings.push({
        id: `saksgang-${detail.id}-${event.event.id ?? 'HOER'}-${date.toISOString().slice(0, 10)}`,
        title,
        subtitle: event.event.hendelse_tekst?.trim() || null,
        statusKind: 'held',
        statusLabel: 'Avholdt',
        deadline: deadline ? deadline.toISOString() : null,
        deadlineLabel: deadline ? `Frist ${formatDateNb(deadline)}` : 'Ingen frist oppgitt',
        startDate: date.toISOString(),
        committee,
        skriftligInnspillUrl: null,
      });
    }

    if (hoer.length === 0) {
      for (const event of frister) {
        const date = event.date!;
        const open = date.getTime() >= Date.now();
        hearings.push({
          id: `saksgang-${detail.id}-HOERFRIST-${date.toISOString().slice(0, 10)}`,
          title,
          subtitle: null,
          statusKind: open ? 'open' : 'held',
          statusLabel: open ? 'Åpen for innspill' : 'Frist utløpt',
          deadline: date.toISOString(),
          deadlineLabel: `Frist ${formatDateNb(date)}`,
          startDate: null,
          committee,
          skriftligInnspillUrl: null,
        });
      }
    }
  }

  return hearings;
}

/** All hearings tied to a sak, newest deadline first. */
export async function collectHearingsForSak(issueId: string): Promise<ChatHearing[]> {
  const [all, detail] = await Promise.all([
    fetchStortingetHoringer(),
    getSakDetail(issueId).catch(() => null),
  ]);
  const linked = findHoringerForSak(all, issueId).map(shapeChatHearing);
  const fromSaksgang = detail ? hearingsFromSaksgang(detail) : [];

  const linkedStartDates = new Set(
    linked
      .map((hearing) => hearing.startDate?.slice(0, 10) ?? '')
      .filter(Boolean),
  );
  const combined = new Map<string, ChatHearing>();
  for (const hearing of linked) {
    combined.set(`hearing:${hearing.id}`, hearing);
  }
  for (const hearing of fromSaksgang) {
    if (hearing.startDate && linkedStartDates.has(hearing.startDate.slice(0, 10))) continue;
    combined.set(`saksgang:${hearing.id}`, hearing);
  }

  return [...combined.values()].sort((a, b) => {
    const aDeadline = a.deadline ? new Date(a.deadline).getTime() : 0;
    const bDeadline = b.deadline ? new Date(b.deadline).getTime() : 0;
    return bDeadline - aDeadline;
  });
}

/** Open and planned hearings on Stortinget, sorted by status then deadline. */
export async function collectOpenHearings(limit = 8): Promise<ChatHearingSearch> {
  const all = await fetchStortingetHoringer();
  const open = all.filter((hearing) => {
    const kind = getHoringStatusKind(hearing);
    return kind === 'open' || kind === 'planned';
  });
  return {
    hearings: sortHoringer(open)
      .slice(0, limit)
      .map(shapeChatHearing),
    summary: summarizeHoringer(all),
  };
}

export type ChatTimelineEvent = {
  id: string | null;
  date: string | null;
  text: string | null;
};

export type ChatTimelineStep = {
  name: string;
  events: ChatTimelineEvent[];
};

export type ChatSakTimeline = {
  title: string;
  statusLabel: string;
  voting: {
    isOpen: boolean;
    closesAt: string | null;
    daysLeft: number | null;
    daysLeftLabel: string | null;
  };
  steps: ChatTimelineStep[];
};

/** Pure shape for a sak's saksgang timeline + voting window. */
export function shapeSakTimeline(
  detail: StortingetSakDetail,
  now?: Date,
): ChatSakTimeline {
  const window = getSakVotingWindow(detail, { now });
  const status = resolveSakStatusFromSources({
    ferdigbehandlet: detail.ferdigbehandlet ?? null,
    detailJson: detail,
  });
  return {
    title: detail.korttittel?.trim() || detail.tittel?.trim() || `Sak ${detail.id}`,
    statusLabel: getSakTreatmentLabel(status),
    voting: {
      isOpen: window.isOpen,
      closesAt: window.closesAt ? window.closesAt.toISOString() : null,
      daysLeft: window.daysLeft,
      daysLeftLabel: formatVotingDaysLeftLabel(window.daysLeft),
    },
    steps: (detail.saksgang?.saksgang_steg_liste ?? []).map((step) => ({
      name: step.navn,
      events: (step.saksgang_hendelse_liste ?? []).map((event) => ({
        id: event.id ?? null,
        date: event.dato ?? null,
        text: event.hendelse_tekst ?? null,
      })),
    })),
  };
}

/** Fetch live sak detail and shape it, or null when Stortinget has no detail. */
export async function collectSakTimeline(issueId: string): Promise<ChatSakTimeline | null> {
  const detail = await getSakDetail(issueId);
  return detail ? shapeSakTimeline(detail) : null;
}

export type ChatSakDocument = {
  id: string;
  title: string;
  kind: string;
  sourceUrl: string | null;
  viewable: boolean;
};

export type ChatSakDocumentGroup = {
  kind: string;
  label: string;
  documents: ChatSakDocument[];
};

export type ChatSakDocumentListing = {
  total: number;
  groups: ChatSakDocumentGroup[];
};

/** Pure shape for grouped sak documents. */
export function shapeSakDocumentGroups(
  detail: StortingetSakDetail | null | undefined,
): ChatSakDocumentListing {
  const documents = parseSakDocuments(detail);
  return {
    total: documents.length,
    groups: groupSakDocumentsByKind(documents).map((group) => ({
      kind: group.kind,
      label: group.label,
      documents: group.documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        kind: doc.kind,
        sourceUrl: doc.sourceUrl,
        viewable: doc.viewable,
      })),
    })),
  };
}

/** Fetch live sak detail and shape its document list. */
export async function collectSakDocumentGroups(
  issueId: string,
): Promise<ChatSakDocumentListing | null> {
  const detail = await getSakDetail(issueId);
  return detail ? shapeSakDocumentGroups(detail) : null;
}

export type ChatPolitician = {
  id: string;
  name: string;
  parti: string | null;
  fylke: string | null;
  tittel: string | null;
  departement: string | null;
  erRegjeringsmedlem: boolean;
};

export function shapeChatPolitician(politician: PolitikerOversikt): ChatPolitician {
  return {
    id: politician.id,
    name: `${politician.fornavn} ${politician.etternavn}`.trim(),
    parti: politician.parti?.navn ?? null,
    fylke: politician.fylke?.navn ?? null,
    tittel: politician.tittel ?? null,
    departement: politician.departement ?? null,
    erRegjeringsmedlem: politician.erRegjeringsmedlem,
  };
}

export type ChatPoliticianSearch = {
  matches: ChatPolitician[];
  note: string | null;
};

/**
 * Match the active-period MP/government roster by id or name. Pure over the
 * roster so it is unit-testable; the async roster fetch lives in
 * `collectPoliticianMatches`.
 */
export function matchPolitikere(
  roster: PolitikerOversikt[],
  args: { personId?: string | null; query?: string | null },
  limit = 8,
): ChatPoliticianSearch {
  const personId = args.personId?.trim();
  if (personId) {
    const matches = roster.filter((politician) => politician.id === personId);
    return {
      matches: matches.slice(0, limit).map(shapeChatPolitician),
      note: matches.length > 0 ? null : 'Fant ingen politiker med denne id-en i perioden.',
    };
  }

  const terms = (args.query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);
  if (terms.length === 0) {
    return { matches: [], note: 'Oppgi person-id eller et navn å søke etter.' };
  }

  const matches = roster.filter((politician) => {
    const haystack = `${politician.fornavn} ${politician.etternavn}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
  return {
    matches: matches.slice(0, limit).map(shapeChatPolitician),
    note: matches.length > 0 ? null : 'Fant ingen politiker som matcher navnet.',
  };
}

/** Fetch the active-period roster and match by id/name. */
export async function collectPoliticianMatches(args: {
  personId?: string | null;
  query?: string | null;
}): Promise<ChatPoliticianSearch> {
  const roster = await getPolitikereOversikt();
  if (roster.length === 0) {
    return { matches: [], note: 'Klarte ikke hente politikeroversikten fra Stortinget akkurat nå.' };
  }
  return matchPolitikere(roster, args);
}
