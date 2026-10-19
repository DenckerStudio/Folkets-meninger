'use client';

import Link from 'next/link';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import {
  OPPFANGET_DISPLAY_STATUS_LABELS,
  OPPFANGET_DISPLAY_TYPE_LABELS,
} from '@/lib/admin/oppfanget/mapping';
import { formatSensitiveTemaCell } from '@/lib/admin/oppfanget/sensitive-category';
import type { OppfangetRow } from '@/lib/admin/oppfanget/types';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

export function formatOppfangetDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('nb-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
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
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
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

function SourcesList({ row }: { row: OppfangetRow }) {
  if (row.sources.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <ul className="space-y-1">
      {row.sources.map((s) => (
        <li key={s.id} className="text-xs leading-snug">
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-brand hover:underline"
          >
            <span className="break-all">{s.publisher ?? 'Kilde'}</span>
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
          </a>
          {s.signalOnly ? <span className="text-muted-foreground"> (signal)</span> : null}
        </li>
      ))}
    </ul>
  );
}

function PollLinkCell({ row }: { row: OppfangetRow }) {
  const link = oppfangetPollLink(row);
  if (!link) return <span className="text-muted-foreground">—</span>;
  return (
    <Link href={link} className="font-medium text-brand hover:underline whitespace-nowrap">
      {row.pollStatus === 'draft' ? 'Åpne utkast' : 'Åpne avstemning'}
    </Link>
  );
}

function TitleCell({ row }: { row: OppfangetRow }) {
  return (
    <div className="min-w-0">
      <div className="flex items-start gap-1.5">
        {row.sensitive ? (
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
            aria-label="Sensitivt tema"
          />
        ) : null}
        <span className="line-clamp-3 font-medium text-foreground">{row.title}</span>
      </div>
      {row.confidence != null ? (
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Konfidens: {row.confidence.toFixed(2)}
        </p>
      ) : null}
    </div>
  );
}

export function OppfangetDesktopTable({ rows }: { rows: OppfangetRow[] }) {
  return (
    <div className="hidden sm:block">
      <p className="mb-2 text-xs text-muted-foreground">
        Tabellen kan rulleres horisontalt dersom vinduet er smalt.
      </p>
      <div className="max-w-full overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-0 table-fixed text-left text-[11px] leading-snug">
          <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-[24%] px-1.5 py-1.5 font-medium">Tittel</th>
              <th className="w-[7%] px-1.5 py-1.5 font-medium">Type</th>
              <th className="w-[10%] px-1.5 py-1.5 font-medium">Status</th>
              <th className="w-[13%] px-1.5 py-1.5 font-medium">Kilder</th>
              <th className="w-[14%] px-1.5 py-1.5 font-medium">Dato</th>
              <th className="w-[14%] px-1.5 py-1.5 font-medium">Skala</th>
              <th className="w-[12%] px-1.5 py-1.5 font-medium">Sensitivt tema</th>
              <th className="w-[6%] px-1.5 py-1.5 font-medium">Lenke</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="align-top hover:bg-muted/20">
                <td className="px-2 py-2">
                  <TitleCell row={row} />
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {OPPFANGET_DISPLAY_TYPE_LABELS[row.displayType]}
                </td>
                <td className="px-2 py-2">
                  <StatusBadge row={row} />
                </td>
                <td className="px-2 py-2">
                  <SourcesList row={row} />
                </td>
                <td className="px-2 py-2 text-muted-foreground">
                  <div className="whitespace-nowrap">Først: {formatOppfangetDateTime(row.firstSeenAt)}</div>
                  <div className="whitespace-nowrap">Sist: {formatOppfangetDateTime(row.lastSeenAt)}</div>
                </td>
                <td className="px-2 py-2">
                  <div>{formatOppfangetScale(row)}</div>
                  {row.scale?.sourceUrl ? (
                    <a
                      href={row.scale.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-0.5 text-brand hover:underline"
                    >
                      Tall-kilde
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  ) : null}
                </td>
                <td className="px-2 py-2 text-muted-foreground leading-snug">
                  {formatSensitiveTemaCell(row.sensitive, row.sensitiveCategory)}
                </td>
                <td className="px-2 py-2">
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
      {rows.map((row) => (
        <li key={row.id} className="rounded-xl border border-border bg-card p-4 text-sm shadow-sm">
          <TitleCell row={row} />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-muted px-2 py-0.5">
              {OPPFANGET_DISPLAY_TYPE_LABELS[row.displayType]}
            </span>
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
              <dd className="mt-0.5 text-muted-foreground">
                Først {formatOppfangetDateTime(row.firstSeenAt)} · Sist{' '}
                {formatOppfangetDateTime(row.lastSeenAt)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Skala</dt>
              <dd className="mt-0.5">{formatOppfangetScale(row)}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Sensitivt tema</dt>
              <dd className="mt-0.5">{formatSensitiveTemaCell(row.sensitive, row.sensitiveCategory)}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Lenke</dt>
              <dd className="mt-0.5">
                <PollLinkCell row={row} />
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
