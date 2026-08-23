import type { KalenderEvent } from '@/lib/kalender-events';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format Date as UTC iCalendar DATETIME (YYYYMMDDTHHMMSSZ). */
export function formatIcsUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  );
}

/** Escape text per RFC 5545. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n');
}

function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let remaining = line;
  parts.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    parts.push(` ${remaining.slice(0, 74)}`);
    remaining = remaining.slice(74);
  }
  return parts.join('\r\n');
}

function buildDescription(event: KalenderEvent, absoluteUrl: string): string {
  const bits: string[] = [];
  if (event.kind === 'deadline' && event.deadlineLabel) {
    bits.push(event.deadlineLabel);
  } else {
    bits.push('Høringssesjon');
  }
  if (event.komite) bits.push(`Komité: ${event.komite}`);
  bits.push(absoluteUrl);
  return bits.join('\n');
}

function eventToVevent(event: KalenderEvent, siteOrigin: string): string[] {
  const absoluteUrl = `${siteOrigin.replace(/\/$/, '')}${event.href}`;
  const summary =
    event.kind === 'deadline' && event.deadlineLabel
      ? `${event.deadlineLabel}: ${event.title}`
      : event.title;
  const lines = [
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(event.id)}@folketsmeninger`,
    `DTSTAMP:${formatIcsUtc(new Date())}`,
    `DTSTART:${formatIcsUtc(event.start)}`,
  ];
  if (event.end) {
    lines.push(`DTEND:${formatIcsUtc(event.end)}`);
  } else if (event.kind === 'deadline') {
    // One-hour block so all-day-ish deadlines still show a slot.
    const end = new Date(event.start.getTime() + 60 * 60 * 1000);
    lines.push(`DTEND:${formatIcsUtc(end)}`);
  } else {
    const end = new Date(event.start.getTime() + 2 * 60 * 60 * 1000);
    lines.push(`DTEND:${formatIcsUtc(end)}`);
  }
  lines.push(`SUMMARY:${escapeIcsText(summary)}`);
  lines.push(`DESCRIPTION:${escapeIcsText(buildDescription(event, absoluteUrl))}`);
  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }
  lines.push(`URL:${absoluteUrl}`);
  lines.push('TRANSP:OPAQUE');
  lines.push('END:VEVENT');
  return lines;
}

export function buildHoringerIcs(events: KalenderEvent[], siteOrigin: string): string {
  const header = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Folkets meninger//Horinger//NO',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Folkets meninger – Høringer',
    'X-WR-TIMEZONE:Europe/Oslo',
  ];
  const body = events.flatMap((e) => eventToVevent(e, siteOrigin));
  const footer = ['END:VCALENDAR'];
  return [...header, ...body, ...footer].map(foldIcsLine).join('\r\n') + '\r\n';
}

export const STORTINGET_HORINGER_ICS_URL =
  'https://www.stortinget.no/api/kalender/geticalhearings?languageCode=no';

export function resolveKalenderSiteOrigin(requestUrl?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (requestUrl) {
    try {
      return new URL(requestUrl).origin;
    } catch {
      /* ignore */
    }
  }
  return 'https://folketsstemme.no';
}
