import { getPolitikereOversikt, getSakDetail, type PolitikerOversikt, type StortingetSakDetail } from '@/lib/stortinget';
import {
  fetchStortingetHoringer,
  findHoringerForSak,
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
  skriftligInnspillUrl: string;
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

/** All hearings tied to a sak, newest deadline first. */
export async function collectHearingsForSak(issueId: string): Promise<ChatHearing[]> {
  const all = await fetchStortingetHoringer();
  return findHoringerForSak(all, issueId)
    .sort((a, b) => {
      const aDeadline = getHoringInnspillDeadline(a)?.getTime() ?? 0;
      const bDeadline = getHoringInnspillDeadline(b)?.getTime() ?? 0;
      return bDeadline - aDeadline;
    })
    .map(shapeChatHearing);
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
