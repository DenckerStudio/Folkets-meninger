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
import { REEL_TEXT_HIT } from '@/lib/polls/reel-tap-targets';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const cellClass = 'min-w-0 overflow-hidden break-words px-2 py-1.5 align-top text-xs';
const mobileTextLinkClass = cn(
  REEL_TEXT_HIT,
  'gap-1 text-xs font-medium text-brand hover:underline',
);
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
  return time ? `${date} ${time}` : date;
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
        'inline-flex max-w-full whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium leading-snug',
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

function ScaleSourceLink({ url, mobile = false }: { url: string; mobile?: boolean }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={mobile ? mobileTextLinkClass : cn(tapLinkClass, 'text-xs')}
    >
      Tall-kilde
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
    </a>
  );
}

function SourcesList({ row, mobile = false }: { row: OppfangetRow; mobile?: boolean }) {
  if (row.sources.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const linkClass = mobile ? cn(mobileTextLinkClass, 'break-words') : tapLinkClass;
  return (
    <ul className="space-y-0.5">
      {row.sources.map((s) => (
        <li key={s.id} className="text-xs leading-snug">
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
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

function PollLinkCell({ row, mobile = false }: { row: OppfangetRow; mobile?: boolean }) {
  const link = oppfangetPollLink(row);
  if (!link) return <span className="text-xs text-muted-foreground">—</span>;
  const isDraft = row.pollStatus === 'draft';
  const label = mobile
    ? isDraft
      ? 'Åpne utkast'
      : 'Åpne avstemning'
    : isDraft
      ? 'Utkast'
      : 'Avstemning';
  return (
    <Link
      href={link}
      className={mobile ? mobileTextLinkClass : cn(tapLinkClass, 'font-medium')}
      aria-label={isDraft ? 'Åpne utkast' : 'Åpne avstemning'}
    >
      {label}
    </Link>
  );
}

function TitleCell({
  row,
  showTypeMeta = false,
  desktopTable = false,
}: {
  row: OppfangetRow;
  showTypeMeta?: boolean;
  desktopTable?: boolean;
}) {
  const typeLabel = showTypeMeta ? OPPFANGET_DISPLAY_TYPE_LABELS[row.displayType] : null;
  const confidenceLabel =
    row.confidence != null ? formatOppfangetConfidence(row.confidence) : null;
  const showMeta = Boolean(typeLabel || confidenceLabel);

  return (
    <div className="min-w-0 overflow-hidden" lang={desktopTable ? 'nb' : undefined}>
      <div className="flex min-w-0 items-start gap-1">
        {row.sensitive ? (
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
            aria-label="Sensitivt tema"
          />
        ) : null}
        <span
          title={row.title}
          className={cn(
            'min-w-0 font-medium text-foreground',
            desktopTable ? 'line-clamp-2 break-normal hyphens-auto' : 'line-clamp-3 break-words',
          )}
        >
          {row.title}
        </span>
      </div>
      {showMeta ? (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {typeLabel ? <span className="break-words">{typeLabel}</span> : null}
          {typeLabel && confidenceLabel ? <span aria-hidden> · </span> : null}
          {confidenceLabel ? (
            <span className="whitespace-nowrap">{confidenceLabel}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function DesktopDateLines({ firstSeenAt, lastSeenAt }: { firstSeenAt: string; lastSeenAt: string }) {
  return (
    <div className="space-y-1 text-xs">
      <p className="whitespace-nowrap text-muted-foreground">
        <span className="font-medium">Først </span>
        <span className="text-foreground">{formatOppfangetDateTime(firstSeenAt)}</span>
      </p>
      <p className="whitespace-nowrap text-muted-foreground">
        <span className="font-medium">Sist </span>
        <span className="text-foreground">{formatOppfangetDateTime(lastSeenAt)}</span>
      </p>
    </div>
  );
}

function MobileDateLines({ firstSeenAt, lastSeenAt }: { firstSeenAt: string; lastSeenAt: string }) {
  return (
    <div className="space-y-1 text-muted-foreground">
      <p>Først {formatOppfangetDateTime(firstSeenAt)}</p>
      <p>Sist {formatOppfangetDateTime(lastSeenAt)}</p>
    </div>
  );
}

export function OppfangetDesktopTable({ rows }: { rows: OppfangetRow[] }) {
  const statusCell = cn(cellClass, 'w-28 max-w-[7rem] pr-3');
  const headBase = 'px-2 py-1.5 font-medium';

  return (
    <div className="hidden sm:block">
      <p className="mb-2 text-xs text-muted-foreground md:hidden">
        Tabellen kan rulles sideveis på smale skjermer.
      </p>
      <div className="max-w-full overflow-x-auto rounded-xl border border-border md:overflow-x-visible">
        <table className="w-full table-fixed text-left text-xs leading-snug">
          <colgroup>
            <col />
            <col className="w-28" />
            <col className="w-[14%]" />
            <col className="w-36" />
            <col className="w-[14%]" />
            <col className="w-24" />
            <col className="w-16" />
          </colgroup>
          <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className={headBase}>Tittel</th>
              <th className={cn(headBase, 'w-28 pr-3')}>Status</th>
              <th className={headBase}>Kilder</th>
              <th className={headBase}>Dato</th>
              <th className={headBase}>Skala</th>
              <th className={headBase}>Sensitivt tema</th>
              <th className={headBase}>Åpne</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className={cellClass}>
                  <TitleCell row={row} showTypeMeta desktopTable />
                </td>
                <td className={statusCell}>
                  <StatusBadge row={row} />
                </td>
                <td className={cellClass}>
                  <SourcesList row={row} />
                </td>
                <td className={cellClass}>
                  <DesktopDateLines firstSeenAt={row.firstSeenAt} lastSeenAt={row.lastSeenAt} />
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
                  <SourcesList row={row} mobile />
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Dato</dt>
                <dd className="mt-0.5">
                  <MobileDateLines firstSeenAt={row.firstSeenAt} lastSeenAt={row.lastSeenAt} />
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Skala</dt>
                <dd className="mt-0.5 break-words">
                  {formatOppfangetScale(row)}
                  {row.scale?.sourceUrl ? (
                    <ScaleSourceLink url={row.scale.sourceUrl} mobile />
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
                <dd className="mt-1">
                  <PollLinkCell row={row} mobile />
                </dd>
              ) : null}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
