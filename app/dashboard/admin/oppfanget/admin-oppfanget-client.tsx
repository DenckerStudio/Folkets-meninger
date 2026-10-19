'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Loader2, Radar } from 'lucide-react';
import { AdminBackLink } from '@/components/admin/admin-shell';
import { EmptyState } from '@/components/dashboard/empty-state';
import {
  OPPFANGET_DISPLAY_STATUS_LABELS,
  OPPFANGET_DISPLAY_TYPE_LABELS,
} from '@/lib/admin/oppfanget/mapping';
import { listOppfangetMockFiltered } from '@/lib/admin/oppfanget/mock-list';
import type { OppfangetFilterInput } from '@/lib/admin/oppfanget/filters';
import type {
  OppfangetDisplayStatus,
  OppfangetDisplayType,
  OppfangetListResponse,
} from '@/lib/admin/oppfanget/types';
import {
  OppfangetDesktopTable,
  OppfangetMobileCards,
} from './oppfanget-row-views';

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

  const mockMode = Boolean(data?.previewMock ?? initialData?.previewMock);

  const filters = useMemo<OppfangetFilterInput>(
    () => ({
      type,
      status,
      source: source.trim(),
      dateFrom,
      dateTo,
      q: q.trim(),
    }),
    [type, status, source, dateFrom, dateTo, q],
  );

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    if (source.trim()) params.set('source', source.trim());
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (q.trim()) params.set('q', q.trim());
    if (mockMode) params.set('preview', 'mock');
    return params.toString();
  }, [type, status, source, dateFrom, dateTo, q, mockMode]);

  const load = useCallback(() => {
    startTransition(async () => {
      setError('');
      if (mockMode) {
        setData(listOppfangetMockFiltered(filters));
        return;
      }

      try {
        const res = await fetch(`/api/admin/oppfanget${queryString ? `?${queryString}` : ''}`);
        if (res.status === 401 || res.status === 403) {
          setData(null);
          setError('Ingen tilgang');
          return;
        }
        if (!res.ok) {
          setData(null);
          setError('Kunne ikke laste oppfanget-liste');
          return;
        }
        const json = (await res.json()) as OppfangetListResponse;
        setData(json);
      } catch {
        setData(null);
        setError('Kunne ikke laste oppfanget-liste');
      }
    });
  }, [filters, mockMode, queryString]);

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
  const showError = Boolean(error) && rows.length === 0 && !pending;

  return (
    <div className="space-y-6" lang="nb-NO">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Radar className="h-6 w-6 text-brand" aria-hidden />
          Oppfanget
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Meldinger, signaler og aksjoner vi har fanget opp. Tall og kilder er ikke verifisert her.
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
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
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
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
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
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Fra dato</span>
          <input
            type="date"
            lang="nb-NO"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <span className="text-xs text-muted-foreground">Format: dd.mm.åååå</span>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Til dato</span>
          <input
            type="date"
            lang="nb-NO"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <span className="text-xs text-muted-foreground">Format: dd.mm.åååå</span>
        </label>
        <label className="space-y-1 text-sm sm:col-span-2 lg:col-span-1">
          <span className="text-muted-foreground">Søk</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tittel eller kildetittel"
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      {showError ? (
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
          description="Når nye signaler fanges opp, vises de her med kilder og status."
        />
      ) : null}

      {rows.length > 0 ? (
        <>
          <OppfangetMobileCards rows={rows} />
          <OppfangetDesktopTable rows={rows} />
        </>
      ) : null}

      <AdminBackLink />
    </div>
  );
}
