'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Radar } from 'lucide-react';
import { AdminBackLink } from '@/components/admin/admin-shell';
import { EmptyState } from '@/components/dashboard/empty-state';
import {
  OPPFANGET_DISPLAY_STATUS_LABELS,
  OPPFANGET_DISPLAY_TYPE_LABELS,
  OPPFANGET_FILTER_STATUS_LABEL_NOT_ACTION,
} from '@/lib/admin/oppfanget/mapping';
import {
  OPPFANGET_FILTER_CLUSTER_STATUS_NOT_ACTION,
  type OppfangetFilterInput,
  type OppfangetStatusFilter,
} from '@/lib/admin/oppfanget/filters';
import { buildOppfangetAdminPath, buildOppfangetListQueryString } from '@/lib/admin/oppfanget/query';
import type {
  OppfangetDisplayStatus,
  OppfangetDisplayType,
  OppfangetListResponse,
} from '@/lib/admin/oppfanget/types';
import {
  isOppfangetListResponse,
  normalizeOppfangetCounts,
  OPPFANGET_FILTER_EMPTY_DESCRIPTION,
  OPPFANGET_FILTER_EMPTY_TITLE,
  OPPFANGET_PIPELINE_EMPTY_DESCRIPTION,
  OPPFANGET_PIPELINE_EMPTY_TITLE,
  shouldShowOppfangetFilterEmpty,
  shouldShowOppfangetPipelineEmpty,
} from '@/lib/admin/oppfanget/view-state';
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

const STATUS_OPTIONS: { value: OppfangetStatusFilter; label: string }[] = [
  { value: '', label: 'Alle statuser' },
  { value: 'oppfanget', label: OPPFANGET_DISPLAY_STATUS_LABELS.oppfanget },
  { value: 'under_terskel', label: OPPFANGET_DISPLAY_STATUS_LABELS.under_terskel },
  { value: 'utkast_laget', label: OPPFANGET_DISPLAY_STATUS_LABELS.utkast_laget },
  { value: 'publisert', label: OPPFANGET_DISPLAY_STATUS_LABELS.publisert },
  { value: 'avvist', label: OPPFANGET_DISPLAY_STATUS_LABELS.avvist },
  {
    value: OPPFANGET_FILTER_CLUSTER_STATUS_NOT_ACTION,
    label: OPPFANGET_FILTER_STATUS_LABEL_NOT_ACTION,
  },
];

const pillClass =
  'inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-foreground';

function StatusPills({
  counts,
  filteredTotal,
}: {
  counts: OppfangetListResponse['counts'];
  filteredTotal: number;
}) {
  const safeCounts = normalizeOppfangetCounts(counts);
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(safeCounts) as OppfangetDisplayStatus[]).map((key) => (
        <span key={key} className={pillClass}>
          {OPPFANGET_DISPLAY_STATUS_LABELS[key]}
          <span className="rounded-full bg-background px-1.5 py-0.5 text-[11px] tabular-nums">
            {safeCounts[key]}
          </span>
        </span>
      ))}
      <span className={pillClass}>
        Totalt
        <span className="rounded-full bg-background px-1.5 py-0.5 text-[11px] tabular-nums">
          {filteredTotal}
        </span>
      </span>
    </div>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function OppfangetPageHeader({ previewMock }: { previewMock?: boolean }) {
  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
        <Radar className="h-6 w-6 text-brand" aria-hidden />
        Research
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Klynger, kilder og research fra fangstpipelinen. Tall og kilder er ikke verifisert her.
      </p>
      {previewMock ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          Forhåndsvisning med mock-data (kun utvikling).
        </p>
      ) : null}
    </div>
  );
}

export default function AdminOppfangetClient({
  initialData = null,
  initialFilters,
  devPreview,
}: {
  initialData?: OppfangetListResponse | null;
  initialFilters?: OppfangetFilterInput;
  /** Dev-only `preview` query (`mock` | `empty`). */
  devPreview?: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<OppfangetListResponse | null>(initialData);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const hydratedQueryRef = useRef<string | null>(initialData ? '__hydrated__' : null);

  const [type, setType] = useState<'' | OppfangetDisplayType>(initialFilters?.type || '');
  const [status, setStatus] = useState<OppfangetStatusFilter>(initialFilters?.status || '');
  const [source, setSource] = useState(initialFilters?.source || '');
  const [dateFrom, setDateFrom] = useState(initialFilters?.dateFrom || '');
  const [dateTo, setDateTo] = useState(initialFilters?.dateTo || '');
  const [q, setQ] = useState(initialFilters?.q || '');
  const debouncedQ = useDebouncedValue(q, 300);
  const urlSyncReadyRef = useRef(false);

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

  const previewParam = useMemo(() => {
    if (mockMode || devPreview === 'mock') return 'mock';
    if (devPreview === 'empty') return 'empty';
    return null;
  }, [mockMode, devPreview]);

  const queryString = useMemo(
    () => buildOppfangetListQueryString(filters, previewParam),
    [filters, previewParam],
  );

  const urlFilters = useMemo<OppfangetFilterInput>(
    () => ({
      type,
      status,
      source: source.trim(),
      dateFrom,
      dateTo,
      q: debouncedQ.trim(),
    }),
    [type, status, source, dateFrom, dateTo, debouncedQ],
  );

  const clearFilters = useCallback(() => {
    setType('');
    setStatus('');
    setSource('');
    setDateFrom('');
    setDateTo('');
    setQ('');
    const clearedPath = buildOppfangetAdminPath({}, previewParam);
    hydratedQueryRef.current = buildOppfangetListQueryString({}, previewParam);
    router.replace(clearedPath, { scroll: false });
  }, [previewParam, router]);

  useEffect(() => {
    const path = buildOppfangetAdminPath(urlFilters, previewParam);
    if (!urlSyncReadyRef.current) {
      urlSyncReadyRef.current = true;
      if (typeof window !== 'undefined') {
        const current =
          window.location.pathname +
          (window.location.search ? window.location.search : '');
        if (path === current) return;
      }
    }
    router.replace(path, { scroll: false });
  }, [urlFilters, previewParam, router]);

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
          setError('Kunne ikke laste research-liste');
          return;
        }
        const json: unknown = await res.json();
        if (!isOppfangetListResponse(json)) {
          setError('Kunne ikke laste research-liste');
          return;
        }
        setData({
          ...json,
          counts: normalizeOppfangetCounts(json.counts),
        });
      } catch {
        setError('Kunne ikke laste oppfanget-liste');
      }
    });
  }, [queryString]);

  useEffect(() => {
    if (hydratedQueryRef.current === '__hydrated__') {
      hydratedQueryRef.current = queryString;
      return;
    }
    if (hydratedQueryRef.current === queryString) {
      return;
    }
    hydratedQueryRef.current = queryString;
    load();
  }, [load, queryString]);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const rows = data?.rows ?? [];
  const showError = Boolean(error) && rows.length === 0 && !pending;
  const tableMissing = Boolean(data?.tableMissing);

  if (tableMissing && data) {
    return (
      <div className="space-y-6" lang="nb-NO">
        <OppfangetPageHeader previewMock={data.previewMock} />
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-foreground">
          <p className="font-medium">Database ikke klar</p>
          <p className="mt-1 text-muted-foreground">{data.tableMissingMessage}</p>
        </div>
        <AdminBackLink />
      </div>
    );
  }

  return (
    <div className="space-y-6" lang="nb-NO">
      <OppfangetPageHeader previewMock={data?.previewMock} />

      {data ? <StatusPills counts={data.counts} filteredTotal={rows.length} /> : null}

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
            onChange={(e) => setStatus(e.target.value as OppfangetStatusFilter)}
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

      {shouldShowOppfangetFilterEmpty(data, filters, pending) ? (
        <EmptyState
          title={OPPFANGET_FILTER_EMPTY_TITLE}
          description={OPPFANGET_FILTER_EMPTY_DESCRIPTION}
          action={
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex min-h-11 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted/50"
            >
              Nullstill filtre
            </button>
          }
        />
      ) : null}

      {shouldShowOppfangetPipelineEmpty(data, filters, pending) ? (
        <EmptyState
          title={OPPFANGET_PIPELINE_EMPTY_TITLE}
          description={OPPFANGET_PIPELINE_EMPTY_DESCRIPTION}
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
