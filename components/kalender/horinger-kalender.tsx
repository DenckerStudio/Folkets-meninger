'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, Download, MapPin } from 'lucide-react';
import {
  buildMonthGrid,
  countEventsByDay,
  dayKey,
  eventsForDayKey,
  osloParts,
  type KalenderEventDto,
  type KalenderEventKind,
} from '@/lib/kalender-events';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { HoringStatusKind } from '@/lib/stortinget-horinger';

const WEEKDAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'] as const;
const ALL_COMMITTEES = 'Alle komiteer';

type KindFilter = 'all' | KalenderEventKind;
type StatusFilter = 'all' | 'open' | 'planned';

type HoringerKalenderProps = {
  events: KalenderEventDto[];
  icsHttpsUrl: string;
  webcalUrl: string;
  stortingetIcsUrl: string;
};

function kindLabel(kind: KalenderEventKind): string {
  switch (kind) {
    case 'session':
      return 'Sesjon';
    case 'deadline':
      return 'Frist';
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function formatTimeNb(iso: string): string {
  return new Date(iso).toLocaleTimeString('nb-NO', {
    timeZone: 'Europe/Oslo',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDayHeading(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.toLocaleDateString('nb-NO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Oslo',
  });
}

function monthTitle(year: number, monthIndex: number): string {
  const date = new Date(Date.UTC(year, monthIndex, 1, 12));
  return date.toLocaleDateString('nb-NO', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Oslo',
  });
}

export default function HoringerKalender({
  events,
  icsHttpsUrl,
  webcalUrl,
  stortingetIcsUrl,
}: HoringerKalenderProps) {
  const today = osloParts(new Date());
  const todayKey = dayKey(new Date());
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [committeeFilter, setCommitteeFilter] = useState(ALL_COMMITTEES);

  const committees = useMemo(() => {
    const names = new Set<string>();
    for (const event of events) {
      if (event.komite) names.add(event.komite);
    }
    return [ALL_COMMITTEES, ...Array.from(names).sort((a, b) => a.localeCompare(b, 'nb'))];
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((event) => {
      if (kindFilter !== 'all' && event.kind !== kindFilter) return false;
      if (statusFilter === 'open' && event.statusKind !== 'open') return false;
      if (statusFilter === 'planned' && event.statusKind !== 'planned') return false;
      if (committeeFilter !== ALL_COMMITTEES && event.komite !== committeeFilter) return false;
      return true;
    });
  }, [events, kindFilter, statusFilter, committeeFilter]);

  const monthEvents = useMemo(
    () =>
      filtered.filter((event) => {
        const parts = osloParts(new Date(event.start));
        return parts.year === year && parts.month === month;
      }),
    [filtered, year, month],
  );

  const counts = useMemo(() => countEventsByDay(monthEvents), [monthEvents]);
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const selectedEvents = useMemo(
    () => eventsForDayKey(filtered, selectedKey),
    [filtered, selectedKey],
  );

  function goMonth(delta: number) {
    const next = new Date(Date.UTC(year, month + delta, 1, 12));
    const parts = osloParts(next);
    setYear(parts.year);
    setMonth(parts.month);
    const nextMonthKey = `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-01`;
    if (parts.year === today.year && parts.month === today.month) {
      setSelectedKey(todayKey);
    } else {
      setSelectedKey(nextMonthKey);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row">
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as KindFilter)}
          aria-label="Filtrer på type"
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground"
        >
          <option value="all">Alle typer</option>
          <option value="session">Sesjoner</option>
          <option value="deadline">Frister</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filtrer på status"
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground"
        >
          <option value="all">Alle statuser</option>
          <option value="open">Åpen for innspill</option>
          <option value="planned">Planlagt</option>
        </select>
        <select
          value={committeeFilter}
          onChange={(e) => setCommitteeFilter(e.target.value)}
          aria-label="Filtrer på komité"
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground lg:min-w-56"
        >
          {committees.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold capitalize text-foreground">{monthTitle(year, month)}</h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => goMonth(-1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted"
                aria-label="Forrige måned"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setYear(today.year);
                  setMonth(today.month);
                  setSelectedKey(todayKey);
                }}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                I dag
              </button>
              <button
                type="button"
                onClick={() => goMonth(1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted"
                aria-label="Neste måned"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px rounded-xl border border-border bg-border overflow-hidden">
            {WEEKDAYS.map((label) => (
              <div
                key={label}
                className="bg-muted px-1 py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {label}
              </div>
            ))}
            {grid.map((cell) => {
              const count = counts.get(cell.key) ?? 0;
              const selected = cell.key === selectedKey;
              const isToday = cell.key === todayKey;
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => {
                    setSelectedKey(cell.key);
                    if (!cell.inMonth) {
                      setYear(cell.year);
                      setMonth(cell.month);
                    }
                  }}
                  className={cn(
                    'min-h-[4.25rem] bg-card px-1.5 py-1.5 text-left transition-colors hover:bg-muted/70',
                    !cell.inMonth && 'bg-muted/40 text-muted-foreground',
                    selected && 'ring-1 ring-inset ring-brand bg-brand/5',
                  )}
                  aria-pressed={selected}
                  aria-label={`${cell.day}. ${count} hendelser`}
                >
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-sm',
                      isToday && 'bg-brand text-brand-foreground font-semibold',
                    )}
                  >
                    {cell.day}
                  </span>
                  {count > 0 ? (
                    <span className="mt-1 flex flex-wrap gap-0.5">
                      {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full bg-brand-accent" />
                      ))}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {monthEvents.length} hendelser denne måneden
          </p>
        </div>

        <aside>
          <h2 className="mb-3 text-lg font-semibold capitalize text-foreground">
            {formatDayHeading(selectedKey)}
          </h2>
          {selectedEvents.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Ingen høringer denne dagen.
            </p>
          ) : (
            <ul className="space-y-3">
              {selectedEvents.map((event) => (
                <li key={event.id}>
                  <Link
                    href={event.href}
                    className="block rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'text-xs font-semibold',
                          event.kind === 'deadline' ? 'text-brand-accent' : 'text-brand',
                        )}
                      >
                        {event.kind === 'deadline' ? event.deadlineLabel ?? kindLabel(event.kind) : kindLabel(event.kind)}
                      </span>
                      {event.komite ? (
                        <span className="text-xs text-muted-foreground">{event.komite}</span>
                      ) : null}
                      <StatusDot kind={event.statusKind} />
                    </div>
                    <p className="font-medium text-foreground line-clamp-2">{event.title}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTimeNb(event.start)}
                      </span>
                      {event.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {event.location}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:flex-wrap sm:items-center">
        <a
          href={webcalUrl}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground hover:opacity-90"
        >
          <CalendarPlus className="h-4 w-4" />
          Abonner på kalender
        </a>
        <a
          href={icsHttpsUrl}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
        >
          <Download className="h-4 w-4" />
          Last ned .ics
        </a>
        <a
          href={stortingetIcsUrl}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Full historikk fra Stortinget
        </a>
        <Link href={routes.horinger} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
          Til høringslisten
        </Link>
      </div>
    </div>
  );
}

function StatusDot({ kind }: { kind: HoringStatusKind }) {
  const label = (() => {
    switch (kind) {
      case 'open':
        return 'Åpen';
      case 'planned':
        return 'Planlagt';
      case 'held':
        return 'Avholdt';
      case 'cancelled':
        return 'Avlyst';
      default: {
        const _exhaustive: never = kind;
        return _exhaustive;
      }
    }
  })();

  return <span className="text-xs text-muted-foreground">{label}</span>;
}
