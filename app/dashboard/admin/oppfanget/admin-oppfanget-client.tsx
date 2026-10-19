'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertTriangle, ExternalLink, Loader2, Radar } from 'lucide-react';
import { AdminBackLink } from '@/components/admin/admin-shell';
import { EmptyState } from '@/components/dashboard/empty-state';
import {
  OPPFANGET_DISPLAY_STATUS_LABELS,
  OPPFANGET_DISPLAY_TYPE_LABELS,
} from '@/lib/admin/oppfanget/mapping';
import type {
  OppfangetDisplayStatus,
  OppfangetDisplayType,
  OppfangetListResponse,
  OppfangetRow,
} from '@/lib/admin/oppfanget/types';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const TYPE_OPTIONS: { value: '' | OppfangetDisplayType; label: string }[] = [
  { value: '', label: 'Alle typer' },
  { value: 'melding', label: OPPFANGET_DISPLAY_TYPE_LABELS.melding },
  { value: 'opprop', label: OPPFANGET_DISPLAY_TYPE_LABELS.opprop },
  { value: 'aksjon', label: OPPFANGET_DISPLAY_TYPE_LABELS.aksjon },
  { value: 'boikott', label: OPPFANGET_DISPLAY_TYPE_LABELS.boikott },
];

const STATUS_OPTIONS: { value: '' | OppfangetDisplayStatus; label: string }[] = [
  { value: '', label: 'Alle statuser' },
  { value: 'oppfanget', label: OPPFANGET_DISPLAY_STATUS_LABELS.oppfanget },
  { value: 'under_terskel', label: OPPFANGET_DISPLAY_STATUS_LABELS.under_terskel },
  { value: 'utkast_laget', label: OPPFANGET_DISPLAY_STATUS_LABELS.utkast_laget },
  { value: 'publisert', label: OPPFANGET_DISPLAY_STATUS_LABELS.publisert },
  { value: 'avvist', label: OPPFANGET_DISPLAY_STATUS_LABELS.avvist },
];

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('nb-NO', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatScale(row: OppfangetRow): string {
  if (!row.scale?.value) return '—';
  const unit = row.scale.unit ?? '';
  const parts = [`ca. ${row.scale.value.toLocaleString('nb-NO')}${unit ? ` ${unit}` : ''}`];
  if (row.scale.asOf) parts.push(`(${row.scale.asOf})`);
  return parts.join(' ');
}

function pollLink(row: OppfangetRow): string | null {
  if (!row.pollId) return null;
  if (row.pollStatus === 'draft') return routes.adminReels;
  return routes.poll(row.pollId);
}

function StatusPills({ counts }: { counts: OppfangetListResponse['counts'] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(counts) as OppfangetDisplayStatus[]).map((key) => (
        <span
          key={key}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-foreground"
        >
          {OPPFANGET_DISPLAY_STATUS_LABELS[key]}
          <span className="rounded-full bg-background px-1.5 py-0.5 text-[11px] tabular-nums">
            {counts[key]}
          </span>
        </span>
      ))}
    </div>
  );
}

export default function AdminOppfangetClient({
  initialData = null,
}: {
  initialData?: OppfangetListResponse | null;
}) {
  const [data, setData] = useState<OppfangetListResponse | null>(initialData);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const skipInitialFetch = useRef(Boolean(initialData));

  const [type, setType] = useState<'' | OppfangetDisplayType>('');
  const [status, setStatus] = useState<'' | OppfangetDisplayStatus>('');
  const [source, setSource] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [q, setQ] = useState('');

  const previewMock = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('preview') === 'mock';
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    if (source.trim()) params.set('source', source.trim());
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (q.trim()) params.set('q', q.trim());
    if (previewMock) params.set('preview', 'mock');
    return params.toString();
  }, [type, status, source, dateFrom, dateTo, q, previewMock]);

  const load = useCallback(() => {
    startTransition(async () => {
      setError('');
      try {
        const res = await fetch(`/api/admin/oppfanget${queryString ? `?${queryString}` : ''}`);
        if (res.status === 401 || res.status === 403) {
          setError('Ingen tilgang');
          return;
        }
        if (!res.ok) {
          setError('Kunne ikke laste oppfanget-liste');
          return;
        }
        const json = (await res.json()) as OppfangetListResponse;
        setData(json);
      } catch {
        setError('Kunne ikke laste oppfanget-liste');
      }
    });
  }, [queryString]);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    load();
  }, [load]);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Radar className="h-6 w-6 text-brand" aria-hidden />
          Oppfanget
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Meldinger, signaler og aksjoner fra fangstpipelinen (n8n). Tall og kilder er ikke verifisert
          her.
        </p>
        {data?.previewMock ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            Forhåndsvisning med mock-data (kun utvikling).
          </p>
        ) : null}
      </div>

      {data?.tableMissing ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-foreground">
          <p className="font-medium">Database ikke klar</p>
          <p className="mt-1 text-muted-foreground">{data.tableMissingMessage}</p>
        </div>
      ) : null}

      {data && !data.tableMissing ? <StatusPills counts={data.counts} /> : null}

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as '' | OppfangetDisplayType)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as '' | OppfangetDisplayStatus)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Kilde (utgiver)</span>
          <input
            type="search"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="f.eks. nrk.no"
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Fra dato</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Til dato</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2 lg:col-span-1">
          <span className="text-muted-foreground">Søk</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tittel eller kildetittel"
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : null}

      {pending && !data ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Laster…
        </p>
      ) : null}

      {!pending && data && rows.length === 0 ? (
        <EmptyState
          title="Ingenting oppfanget ennå"
          description="Når pipelinen lagrer klynger i action_clusters, vises de her med kilder og status."
        />
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Tittel</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Kilder</th>
                <th className="px-3 py-2 font-medium">Dato</th>
                <th className="px-3 py-2 font-medium">Skala</th>
                <th className="px-3 py-2 font-medium">Sikkerhet</th>
                <th className="px-3 py-2 font-medium">Utkast</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const link = pollLink(row);
                return (
                  <tr key={row.id} className="align-top hover:bg-muted/20">
                    <td className="max-w-[14rem] px-3 py-3 font-medium text-foreground">
                      <div className="flex flex-wrap items-start gap-1.5">
                        {row.sensitive ? (
                          <AlertTriangle
                            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                            aria-label="Sensitivt tema"
                          />
                        ) : null}
                        <span>{row.title}</span>
                      </div>
                      {row.confidence != null ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Konfidens: {row.confidence.toFixed(2)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {OPPFANGET_DISPLAY_TYPE_LABELS[row.displayType]}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          row.displayStatus === 'avvist' && 'bg-destructive/10 text-destructive',
                          row.displayStatus === 'publisert' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                          row.displayStatus === 'utkast_laget' && 'bg-brand/10 text-brand',
                          row.displayStatus === 'under_terskel' && 'bg-muted text-muted-foreground',
                          row.displayStatus === 'oppfanget' && 'bg-muted/60 text-foreground',
                        )}
                      >
                        {OPPFANGET_DISPLAY_STATUS_LABELS[row.displayStatus]}
                      </span>
                    </td>
                    <td className="max-w-[12rem] px-3 py-3">
                      <ul className="space-y-1">
                        {row.sources.length === 0 ? (
                          <li className="text-muted-foreground">—</li>
                        ) : (
                          row.sources.map((s) => (
                            <li key={s.id} className="text-xs">
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-brand hover:underline"
                              >
                                {s.publisher ?? 'Kilde'}
                                <ExternalLink className="h-3 w-3" aria-hidden />
                              </a>
                              {s.signalOnly ? (
                                <span className="ml-1 text-muted-foreground">(signal)</span>
                              ) : null}
                            </li>
                          ))
                        )}
                      </ul>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      <div>Først: {formatDate(row.firstSeenAt)}</div>
                      <div>Sist: {formatDate(row.lastSeenAt)}</div>
                    </td>
                    <td className="max-w-[10rem] px-3 py-3 text-xs">
                      <div>{formatScale(row)}</div>
                      {row.scale?.sourceUrl ? (
                        <a
                          href={row.scale.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-brand hover:underline"
                        >
                          Kilde for tall
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {row.sensitive
                        ? row.sensitiveCategory ?? 'Sensitivt'
                        : 'Nei'}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {link ? (
                        <Link href={link} className="font-medium text-brand hover:underline">
                          {row.pollStatus === 'draft' ? 'Åpne utkast' : 'Åpne avstemning'}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <AdminBackLink />
    </div>
  );
}
