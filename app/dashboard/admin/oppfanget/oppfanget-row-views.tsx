'use client';

import Link from 'next/link';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { formatOppfangetConfidence } from '@/lib/admin/oppfanget/format-confidence';
import {
  OPPFANGET_DISPLAY_STATUS_LABELS,
  OPPFANGET_DISPLAY_TYPE_LABELS,
} from '@/lib/admin/oppfanget/mapping';
import { formatSensitiveTemaCell } from '@/lib/admin/oppfanget/sensitive-category';
import type { OppfangetRow } from '@/lib/admin/oppfanget/types';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const cellClass = 'min-w-0 overflow-hidden break-words px-1.5 py-1.5 align-top text-xs';
const tapLinkClass =
  'inline-flex min-h-11 max-w-full items-center gap-1 break-words text-brand hover:underline';

export function splitNbDateTime(iso: string): { date: string; time: string } {
  try {
    const d = new Date(iso);
    return {
      date: new Intl.DateTimeFormat('nb-NO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(d),
      time: new Intl.DateTimeFormat('nb-NO', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(d),
    };
  } catch {
    return { date: iso, time: '' };
  }
}

export function formatOppfangetDateTime(iso: string): string {
  const { date, time } = splitNbDateTime(iso);
  return time ? `${date}, ${time}` : date;
}

function formatAsOfDate(value: string): string {
  const d = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatOppfangetScale(row: OppfangetRow): string {
  if (!row.scale?.value) return '—';
  const unit = row.scale.unit ?? '';
  const parts = [`ca. ${row.scale.value.toLocaleString('nb-NO')}${unit ? ` ${unit}` : ''}`];
  if (row.scale.asOf) parts.push(`(${formatAsOfDate(row.scale.asOf)})`);
  return parts.join(' ');
}

export function oppfangetPollLink(row: OppfangetRow): string | null {
  if (!row.pollId) return null;
  if (row.pollStatus === 'draft') return routes.adminReels;
  return routes.poll(row.pollId);
}

function StatusBadge({ row }: { row: OppfangetRow }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full break-words rounded-full px-2 py-0.5 text-xs font-medium leading-snug',
        row.displayStatus === 'avvist' && 'bg-destructive/10 text-destructive',
        row.displayStatus === 'publisert' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        row.displayStatus === 'utkast_laget' && 'bg-brand/10 text-brand',
        row.displayStatus === 'under_terskel' && 'bg-muted text-muted-foreground',
        row.displayStatus === 'oppfanget' && 'bg-muted/60 text-foreground',
      )}
    >
      {OPPFANGET_DISPLAY_STATUS_LABELS[row.displayStatus]}
    </span>
  );
}

function ScaleSourceLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(tapLinkClass, 'text-xs')}
    >
      Kilde
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
    </a>
  );
}

function SourcesList({ row }: { row: OppfangetRow }) {
  if (row.sources.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <ul className="space-y-0.5">
      {row.sources.map((s) => (
        <li key={s.id} className="text-xs leading-snug">
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className={tapLinkClass}
          >
            <span className="break-words">{s.publisher ?? 'Kilde'}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </a>
          {s.signalOnly ? <span className="text-muted-foreground"> (signal)</span> : null}
        </li>
      ))}
    </ul>
  );
}

function PollLinkCell({ row }: { row: OppfangetRow }) {
  const link = oppfangetPollLink(row);
  if (!link) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <Link href={link} className={cn(tapLinkClass, 'font-medium')}>
      Åpne
    </Link>
  );
}

function TitleCell({ row, showTypeMeta = false }: { row: OppfangetRow; showTypeMeta?: boolean }) {
  const metaParts: string[] = [];
  if (showTypeMeta) {
    metaParts.push(OPPFANGET_DISPLAY_TYPE_LABELS[row.displayType]);
  }
  if (row.confidence != null) {
    metaParts.push(formatOppfangetConfidence(row.confidence));
  }

  return (
    <div className="min-w-0 overflow-hidden">
      <div className="flex items-start gap-1">
        {row.sensitive ? (
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
            aria-label="Sensitivt tema"
          />
        ) : null}
        <span className="line-clamp-3 break-words font-medium text-foreground">{row.title}</span>
      </div>
      {metaParts.length > 0 ? (
        <p className="mt-0.5 break-words text-xs text-muted-foreground">{metaParts.join(' · ')}</p>
      ) : null}
    </div>
  );
}

function DateCell({ label, iso }: { label: string; iso: string }) {
  const { date, time } = splitNbDateTime(iso);
  return (
    <div className="min-w-0 overflow-hidden break-words text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="mt-0.5 block break-words text-foreground">{date}</span>
      {time ? <span className="block break-words text-muted-foreground">{time}</span> : null}
    </div>
  );
}

export function OppfangetDesktopTable({ rows }: { rows: OppfangetRow[] }) {
  return (
    <div className="hidden sm:block">
      <p className="mb-2 text-xs text-muted-foreground lg:hidden">
        Tabellen kan rulles sideveis på smale skjermer.
      </p>
      <div className="max-w-full overflow-x-auto rounded-xl border border-border lg:overflow-x-visible">
        <table className="w-full table-fixed text-left text-xs leading-snug">
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[12%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[16%]" />
            <col className="w-[14%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-1.5 py-1.5 font-medium">Tittel</th>
              <th className="px-1.5 py-1.5 font-medium">Status</th>
              <th className="px-1.5 py-1.5 font-medium">Kilder</th>
              <th className="px-1.5 py-1.5 font-medium">Dato</th>
              <th className="px-1.5 py-1.5 font-medium">Skala</th>
              <th className="px-1.5 py-1.5 font-medium">Sensitivt tema</th>
              <th className="px-1.5 py-1.5 font-medium">Åpne</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className={cellClass}>
                  <TitleCell row={row} showTypeMeta />
                </td>
                <td className={cellClass}>
                  <StatusBadge row={row} />
                </td>
                <td className={cellClass}>
                  <SourcesList row={row} />
                </td>
                <td className={cn(cellClass, 'text-muted-foreground')}>
                  <DateCell label="Først" iso={row.firstSeenAt} />
                  <div className="mt-1.5">
                    <DateCell label="Sist" iso={row.lastSeenAt} />
                  </div>
                </td>
                <td className={cellClass}>
                  <div className="break-words">{formatOppfangetScale(row)}</div>
                  {row.scale?.sourceUrl ? <ScaleSourceLink url={row.scale.sourceUrl} /> : null}
                </td>
                <td className={cn(cellClass, 'text-muted-foreground')}>
                  {formatSensitiveTemaCell(row.sensitive, row.sensitiveCategory)}
                </td>
                <td className={cellClass}>
                  <PollLinkCell row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function OppfangetMobileCards({ rows }: { rows: OppfangetRow[] }) {
  return (
    <ul className="space-y-3 sm:hidden">
      {rows.map((row) => {
        const pollLink = oppfangetPollLink(row);
        const sensitiveLabel = row.sensitive
          ? formatSensitiveTemaCell(row.sensitive, row.sensitiveCategory)
          : null;

        return (
          <li key={row.id} className="rounded-xl border border-border bg-card p-4 text-sm shadow-sm">
            <TitleCell row={row} showTypeMeta />
            <div className="mt-2">
              <StatusBadge row={row} />
            </div>
            <dl className="mt-3 space-y-2 text-xs">
              <div>
                <dt className="font-medium text-muted-foreground">Kilder</dt>
                <dd className="mt-0.5">
                  <SourcesList row={row} />
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Dato</dt>
                <dd className="mt-0.5 space-y-1 text-muted-foreground">
                  <DateCell label="Først" iso={row.firstSeenAt} />
                  <DateCell label="Sist" iso={row.lastSeenAt} />
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Skala</dt>
                <dd className="mt-0.5 break-words">
                  {formatOppfangetScale(row)}
                  {row.scale?.sourceUrl ? (
                    <div className="mt-1">
                      <ScaleSourceLink url={row.scale.sourceUrl} />
                    </div>
                  ) : null}
                </dd>
              </div>
              {sensitiveLabel ? (
                <div>
                  <dt className="font-medium text-muted-foreground">Sensitivt tema</dt>
                  <dd className="mt-0.5">{sensitiveLabel}</dd>
                </div>
              ) : null}
              {pollLink ? (
                <div>
                  <dt className="font-medium text-muted-foreground">Åpne</dt>
                  <dd className="mt-0.5">
                    <PollLinkCell row={row} />
                  </dd>
                </div>
              ) : null}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
