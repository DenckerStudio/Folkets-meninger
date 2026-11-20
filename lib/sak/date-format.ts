/**
 * Ett datoformat på saksiden: «9. april 2026» (nb-NO, lang måned, Europe/Oslo).
 * Stortinget sender datoer som `/Date(ms+tz)/`, `dd.mm.yyyy [hh:mm:ss]` og ISO.
 */

const OSLO_TIME_ZONE = 'Europe/Oslo';
const MIN_PLAUSIBLE_YEAR = 1900;
const MAX_PLAUSIBLE_YEAR = 2200;

const SAK_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: OSLO_TIME_ZONE,
};

function isPlausibleYear(year: number): boolean {
  return year >= MIN_PLAUSIBLE_YEAR && year <= MAX_PLAUSIBLE_YEAR;
}

function utcNoon(year: number, month: number, day: number): Date | null {
  if (!isPlausibleYear(year) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Middag UTC gir samme kalenderdag i Europe/Oslo uavhengig av server-tidssone.
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

/** `01.01.0001` og .NET `DateTime.MinValue` betyr «ingen dato» hos Stortinget. */
export function parseSakDate(raw: string | Date | null | undefined): Date | null {
  if (raw == null) return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) || !isPlausibleYear(raw.getUTCFullYear()) ? null : raw;
  }

  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('01.01.0001')) return null;

  const dotnet = trimmed.match(/\/Date\((-?\d+)(?:[+-]\d+)?\)\//);
  if (dotnet) {
    const date = new Date(Number.parseInt(dotnet[1], 10));
    return Number.isNaN(date.getTime()) || !isPlausibleYear(date.getUTCFullYear()) ? null : date;
  }

  const dotted = trimmed.split(' ')[0].match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotted) {
    return utcNoon(Number(dotted[3]), Number(dotted[2]), Number(dotted[1]));
  }

  const isoDay = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDay) {
    return utcNoon(Number(isoDay[1]), Number(isoDay[2]), Number(isoDay[3]));
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) || !isPlausibleYear(date.getUTCFullYear()) ? null : date;
  }

  return null;
}

export function formatSakDate(date: Date): string {
  return date.toLocaleDateString('nb-NO', SAK_DATE_FORMAT);
}

export function formatSakDateFromRaw(raw: string | Date | null | undefined): string | null {
  const date = parseSakDate(raw);
  return date ? formatSakDate(date) : null;
}

const DOTTED_DATE_IN_TEXT = /(?<![\d.])(\d{1,2})\.(\d{1,2})\.(\d{4})(?![\d]|\.\d)/g;

/**
 * Skriver `09.04.2026` i en visningstekst om til «9. april 2026». Brukes kun til visning:
 * lagrede titler og ID-er skal aldri endres.
 */
export function rewriteDottedDatesForDisplay(text: string): string {
  return text.replace(DOTTED_DATE_IN_TEXT, (match, day: string, month: string, year: string) => {
    const date = utcNoon(Number(year), Number(month), Number(day));
    return date ? formatSakDate(date) : match;
  });
}
