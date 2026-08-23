import { routes } from '@/lib/routes';
import {
  getHoringApplicationDeadline,
  getHoringInnspillDeadline,
  getHoringStatusKind,
  getHoringTitle,
  parseStortingetDate,
  type HoringStatusKind,
  type StortingetHoring,
} from '@/lib/stortinget-horinger';

export type KalenderEventKind = 'session' | 'deadline';

export type KalenderEvent = {
  id: string;
  hearingId: string;
  title: string;
  start: Date;
  end?: Date;
  location?: string;
  kind: KalenderEventKind;
  /** Human label for deadline subtype (innspill / søknad). */
  deadlineLabel?: string;
  komite?: string;
  href: string;
  statusKind: HoringStatusKind;
};

/** JSON-safe shape for client components. */
export type KalenderEventDto = {
  id: string;
  hearingId: string;
  title: string;
  start: string;
  end?: string;
  location?: string;
  kind: KalenderEventKind;
  deadlineLabel?: string;
  komite?: string;
  href: string;
  statusKind: HoringStatusKind;
};

const MS_PER_DAY = 86_400_000;
export const KALENDER_TIMEZONE = 'Europe/Oslo';

export function osloParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: KALENDER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: num('year'), month: num('month') - 1, day: num('day') };
}

export function hearingToKalenderEvents(hearing: StortingetHoring): KalenderEvent[] {
  const hearingId = String(hearing.id);
  const title = getHoringTitle(hearing);
  const href = routes.horing(hearingId);
  const statusKind = getHoringStatusKind(hearing);
  const komite = hearing.komite?.navn?.trim() || undefined;
  const events: KalenderEvent[] = [];

  const sessions = hearing.horingstidspunkt_liste ?? [];
  sessions.forEach((tp, index) => {
    const start = parseStortingetDate(tp.tidspunkt);
    if (!start) return;
    const location = tp.sted?.trim() || undefined;
    events.push({
      id: `${hearingId}-session-${index}`,
      hearingId,
      title,
      start,
      location,
      kind: 'session',
      komite,
      href,
      statusKind,
    });
  });

  if (!events.some((e) => e.kind === 'session')) {
    const startFallback = parseStortingetDate(hearing.start_dato);
    if (startFallback) {
      events.push({
        id: `${hearingId}-session-start`,
        hearingId,
        title,
        start: startFallback,
        kind: 'session',
        komite,
        href,
        statusKind,
      });
    }
  }

  const innspillDeadline = getHoringInnspillDeadline(hearing);
  if (innspillDeadline) {
    events.push({
      id: `${hearingId}-deadline-innspill`,
      hearingId,
      title,
      start: innspillDeadline,
      kind: 'deadline',
      deadlineLabel: 'Innspillsfrist',
      komite,
      href,
      statusKind,
    });
  }

  const applicationDeadline = getHoringApplicationDeadline(hearing);
  if (
    applicationDeadline &&
    (!innspillDeadline || applicationDeadline.getTime() !== innspillDeadline.getTime())
  ) {
    events.push({
      id: `${hearingId}-deadline-soknad`,
      hearingId,
      title,
      start: applicationDeadline,
      kind: 'deadline',
      deadlineLabel: 'Søknadsfrist',
      komite,
      href,
      statusKind,
    });
  }

  return events;
}

export function hearingsToKalenderEvents(hearings: StortingetHoring[]): KalenderEvent[] {
  const events = hearings.flatMap(hearingToKalenderEvents);
  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Keep events within [now - pastDays, now + futureDays]. */
export function filterKalenderEventsByWindow(
  events: KalenderEvent[],
  options: { pastDays?: number; futureDays?: number; now?: Date } = {},
): KalenderEvent[] {
  const pastDays = options.pastDays ?? 90;
  const futureDays = options.futureDays ?? 90;
  const now = options.now ?? new Date();
  const from = now.getTime() - pastDays * MS_PER_DAY;
  const to = now.getTime() + futureDays * MS_PER_DAY;
  return events.filter((e) => {
    const t = e.start.getTime();
    return t >= from && t <= to;
  });
}

export function toKalenderEventDto(event: KalenderEvent): KalenderEventDto {
  return {
    id: event.id,
    hearingId: event.hearingId,
    title: event.title,
    start: event.start.toISOString(),
    end: event.end?.toISOString(),
    location: event.location,
    kind: event.kind,
    deadlineLabel: event.deadlineLabel,
    komite: event.komite,
    href: event.href,
    statusKind: event.statusKind,
  };
}

export function eventsForMonth(events: KalenderEventDto[], year: number, monthIndex: number): KalenderEventDto[] {
  return events.filter((e) => {
    const parts = osloParts(new Date(e.start));
    return parts.year === year && parts.month === monthIndex;
  });
}

export function eventsForDayKey(events: KalenderEventDto[], key: string): KalenderEventDto[] {
  return events
    .filter((e) => dayKey(new Date(e.start)) === key)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

export function dayKeyFromParts(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function dayKey(date: Date): string {
  const { year, month, day } = osloParts(date);
  return dayKeyFromParts(year, month, day);
}

export type MonthGridCell = {
  key: string;
  year: number;
  month: number;
  day: number;
  inMonth: boolean;
};

/** Monday-first month grid of 6 weeks for a civil year/month. */
export function buildMonthGrid(year: number, monthIndex: number): MonthGridCell[] {
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(year, monthIndex, 1, 12)).getUTCDay() + 6) % 7;
  const prevMonth = monthIndex === 0 ? 11 : monthIndex - 1;
  const prevYear = monthIndex === 0 ? year - 1 : year;
  const daysInPrev = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate();

  const cells: MonthGridCell[] = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    const day = daysInPrev - firstWeekday + 1 + i;
    cells.push({
      key: dayKeyFromParts(prevYear, prevMonth, day),
      year: prevYear,
      month: prevMonth,
      day,
      inMonth: false,
    });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      key: dayKeyFromParts(year, monthIndex, day),
      year,
      month: monthIndex,
      day,
      inMonth: true,
    });
  }
  const nextMonth = monthIndex === 11 ? 0 : monthIndex + 1;
  const nextYear = monthIndex === 11 ? year + 1 : year;
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({
      key: dayKeyFromParts(nextYear, nextMonth, nextDay),
      year: nextYear,
      month: nextMonth,
      day: nextDay,
      inMonth: false,
    });
    nextDay += 1;
  }
  return cells;
}

export function countEventsByDay(events: KalenderEventDto[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of events) {
    const key = dayKey(new Date(e.start));
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}
