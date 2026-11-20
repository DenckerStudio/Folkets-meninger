import type { StortingetSakDetail } from '@/lib/stortinget';
import { formatSakDateFromRaw, parseSakDate } from '@/lib/sak/date-format';
import { VOTE_CLOSE_EVENT_IDS } from '@/lib/sak-voting-window';

export type SaksgangEvent = {
  id?: string;
  label: string | null;
  date: string | null;
};

export type SaksgangStep = {
  navn: string;
  events: SaksgangEvent[];
};

type RawSaksgangSteps = NonNullable<StortingetSakDetail['saksgang']>['saksgang_steg_liste'];

/** Stortingets hendelses-ID-er → norsk visningstekst (brukes når `hendelse_tekst` mangler). */
export const SAKSGANG_EVENT_LABELS: Record<string, string> = {
  FRADEP: 'Fra departementet',
  FRAREP: 'Fra representant',
  SAK: 'Sak opprettet',
  FREMMET: 'Fremmet',
  FREMSATT: 'Forslag fremsatt',
  REFS: 'Referert i Stortinget',
  SENDT: 'Sendt til komité',
  KOMITE: 'Til komitébehandling',
  HOERFRIST: 'Høringsfrist',
  HOER: 'Høring',
  ORDFORER: 'Saksordfører oppnevnt',
  INNST: 'Innstilling avgitt',
  AVGITT: 'Innstilling avgitt',
  BEHS: 'Behandlet i Stortinget',
  PLBEHS: 'Planlagt behandling',
  VOT: 'Votering',
  VEDTAK: 'Vedtak',
  DEBATT: 'Debatt',
  LOV: 'Lov vedtatt',
};

/** Stortingets saksgang-datoer; `01.01.0001` betyr «ingen dato». */
export function parseSaksgangEventDate(raw: string | null | undefined): Date | null {
  return parseSakDate(raw);
}

export function formatSaksgangEventDate(raw: string | null | undefined): string | null {
  return formatSakDateFromRaw(raw);
}

export function buildSaksgangSteps(saksgangSteg: RawSaksgangSteps): SaksgangStep[] {
  return (saksgangSteg ?? []).map((steg) => {
    const events: SaksgangEvent[] = [];
    for (const h of steg.saksgang_hendelse_liste ?? []) {
      const ownText = h.hendelse_tekst?.trim() || null;
      const label = ownText ?? SAKSGANG_EVENT_LABELS[h.id ?? ''] ?? null;
      const date = formatSaksgangEventDate(h.dato);
      // Dato uten tekst sier ingenting; hendelser uten dato vises bare med Stortingets egen tekst.
      if (!label || (!date && !ownText)) continue;
      events.push({ id: h.id, label, date });
    }

    return { navn: steg.navn, events };
  });
}

/** Hendelser som viser at Stortinget har behandlet og avgjort saken. */
const DECISION_EVENT_IDS: ReadonlySet<string> = new Set(['BEHS', 'VOT', 'VEDTAK', 'LOV', 'DEBATT']);

/**
 * Siste hendelse i saksgangen som allerede har skjedd (fremtidige, planlagte hendelser teller ikke).
 * Med `onlyEventIds` telles bare de oppgitte hendelsestypene.
 */
export function latestPastSaksgangEventDate(
  saksgangSteg: RawSaksgangSteps,
  now: Date = new Date(),
  onlyEventIds?: ReadonlySet<string>,
): Date | null {
  let latest: Date | null = null;
  for (const steg of saksgangSteg ?? []) {
    for (const h of steg.saksgang_hendelse_liste ?? []) {
      if (onlyEventIds && !(h.id && onlyEventIds.has(h.id))) continue;
      const date = parseSaksgangEventDate(h.dato);
      if (date && date.getTime() <= now.getTime() && (!latest || date.getTime() > latest.getTime())) {
        latest = date;
      }
    }
  }
  return latest;
}

function toIsoDay(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * «Sist oppdatert» skal aldri ligge før siste hendelse i saksgangen. Stortingets
 * `sist_oppdatert_dato` mangler ofte, og vår cache kan være eldre enn saken.
 * Fremtidige hendelser (planlagt behandling) teller ikke.
 */
export function resolveSakLastUpdatedDate(input: {
  sakDate?: string | null;
  cachedLastUpdatedAt?: string | null;
  saksgangSteg: RawSaksgangSteps;
  now?: Date;
}): string | null {
  const now = input.now ?? new Date();
  const candidates: number[] = [];

  for (const raw of [input.sakDate, input.cachedLastUpdatedAt]) {
    if (!raw) continue;
    const ms = new Date(raw).getTime();
    if (!Number.isNaN(ms)) candidates.push(ms);
  }

  const latestEvent = latestPastSaksgangEventDate(input.saksgangSteg, now);
  if (latestEvent) candidates.push(latestEvent.getTime());

  if (candidates.length === 0) return null;
  return toIsoDay(new Date(Math.max(...candidates)));
}

const HALF_DAY_MS = 12 * 60 * 60 * 1000;

/**
 * Nærmeste planlagte behandling/votering i saksgangen. Datoene tolkes som kalenderdager i
 * Europe/Oslo (ikke serverens tidssone), og dagen i dag regnes som kommende.
 */
export function nextPlannedSaksgangDate(
  saksgangSteg: RawSaksgangSteps,
  now: Date = new Date(),
): Date | null {
  let next: Date | null = null;
  for (const steg of saksgangSteg ?? []) {
    for (const h of steg.saksgang_hendelse_liste ?? []) {
      if (!h.id || !VOTE_CLOSE_EVENT_IDS.has(h.id)) continue;
      const date = parseSaksgangEventDate(h.dato);
      if (!date || date.getTime() + HALF_DAY_MS < now.getTime()) continue;
      if (!next || date.getTime() < next.getTime()) next = date;
    }
  }
  return next;
}

/** Dagen Stortinget behandlet/stemte over saken; `null` når saksgangen ikke har en slik hendelse. */
export function saksgangDecisionDate(
  saksgangSteg: RawSaksgangSteps,
  now: Date = new Date(),
): Date | null {
  return latestPastSaksgangEventDate(saksgangSteg, now, DECISION_EVENT_IDS);
}

/** Oppsummeringslinjen til foldeseksjonen for avsluttede saker. */
export function saksgangFinishedSummaryLabel(dateLabel: string | null | undefined): string {
  const date = dateLabel?.trim();
  return date ? `Saksgang – ferdigbehandlet ${date}` : 'Saksgang – ferdigbehandlet';
}
