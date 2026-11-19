import type { StortingetSakDetail } from '@/lib/stortinget';

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

const NB_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Oslo',
};

/**
 * Stortinget sender datoer både som `/Date(ms+tz)/` og som `dd.mm.yyyy hh:mm:ss`.
 * `01.01.0001` er «ingen dato».
 */
export function parseSaksgangEventDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('01.01.0001')) return null;

  const dotnet = trimmed.match(/\/Date\((-?\d+)(?:[+-]\d+)?\)\//);
  if (dotnet) {
    const ms = Number.parseInt(dotnet[1], 10);
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) || date.getUTCFullYear() < 1900 ? null : date;
  }

  const dotted = trimmed.split(' ')[0].match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dotted) {
    const [, day, month, year] = dotted;
    // Middag UTC gir samme kalenderdag i Europe/Oslo uavhengig av server-tidssone.
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
    return Number.isNaN(date.getTime()) || Number(year) < 1900 ? null : date;
  }

  return null;
}

export function formatSaksgangEventDate(raw: string | null | undefined): string | null {
  const date = parseSaksgangEventDate(raw);
  return date ? date.toLocaleDateString('nb-NO', NB_DATE_FORMAT) : null;
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

  for (const steg of input.saksgangSteg ?? []) {
    for (const h of steg.saksgang_hendelse_liste ?? []) {
      const date = parseSaksgangEventDate(h.dato);
      if (date && date.getTime() <= now.getTime()) candidates.push(date.getTime());
    }
  }

  if (candidates.length === 0) return null;
  return toIsoDay(new Date(Math.max(...candidates)));
}
