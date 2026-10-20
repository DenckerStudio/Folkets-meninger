import {
  OPPFANGET_FILTER_CLUSTER_STATUS_NOT_ACTION,
  type OppfangetFilterInput,
  type OppfangetStatusFilter,
} from '@/lib/admin/oppfanget/filters';
import type { OppfangetDisplayStatus, OppfangetDisplayType } from '@/lib/admin/oppfanget/types';
import { routes } from '@/lib/routes';
import {
  ALL_OPPFANGET_DISPLAY_STATUSES,
  ALL_OPPFANGET_DISPLAY_TYPES,
} from '@/lib/admin/oppfanget/mapping';

function parseDisplayType(value: string | undefined): OppfangetDisplayType | '' {
  if (!value) return '';
  return ALL_OPPFANGET_DISPLAY_TYPES.includes(value as OppfangetDisplayType)
    ? (value as OppfangetDisplayType)
    : '';
}

function parseStatusFilter(value: string | undefined): OppfangetStatusFilter {
  if (!value) return '';
  if (value === OPPFANGET_FILTER_CLUSTER_STATUS_NOT_ACTION) {
    return OPPFANGET_FILTER_CLUSTER_STATUS_NOT_ACTION;
  }
  return ALL_OPPFANGET_DISPLAY_STATUSES.includes(value as OppfangetDisplayStatus)
    ? (value as OppfangetDisplayStatus)
    : '';
}

export function parseOppfangetFilters(
  input: Record<string, string | string[] | undefined>,
): OppfangetFilterInput {
  const pick = (key: string) => {
    const raw = input[key];
    return typeof raw === 'string' ? raw : '';
  };
  return {
    type: parseDisplayType(pick('type')),
    status: parseStatusFilter(pick('status')),
    source: pick('source'),
    dateFrom: pick('dateFrom'),
    dateTo: pick('dateTo'),
    q: pick('q'),
  };
}

/** Query string for list API / admin URL (filters + optional dev `preview`). */
export function buildOppfangetListQueryString(
  filters: OppfangetFilterInput,
  preview?: string | null,
): string {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.status) params.set('status', filters.status);
  if (filters.source?.trim()) params.set('source', filters.source.trim());
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (preview === 'mock' || preview === 'empty') params.set('preview', preview);
  return params.toString();
}

export function buildOppfangetAdminPath(
  filters: OppfangetFilterInput,
  preview?: string | null,
): string {
  const query = buildOppfangetListQueryString(filters, preview);
  return query ? `${routes.adminOppfanget}?${query}` : routes.adminOppfanget;
}
