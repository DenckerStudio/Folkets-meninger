import { hasActiveOppfangetFilters, type OppfangetFilterInput } from '@/lib/admin/oppfanget/filters';
import type { OppfangetListResponse, OppfangetStatusCounts } from '@/lib/admin/oppfanget/types';

export const OPPFANGET_PIPELINE_EMPTY_TITLE = 'Ingenting i Research ennå';
export const OPPFANGET_PIPELINE_EMPTY_DESCRIPTION =
  'Når nye klynger fanges opp, vises de her med kilder og status.';
export const OPPFANGET_FILTER_EMPTY_TITLE = 'Ingen treff for filtrene';
export const OPPFANGET_FILTER_EMPTY_DESCRIPTION =
  'Prøv å endre eller fjerne filtervalgene.';

const EMPTY_COUNTS: OppfangetStatusCounts = {
  oppfanget: 0,
  under_terskel: 0,
  utkast_laget: 0,
  publisert: 0,
  avvist: 0,
};

export function normalizeOppfangetCounts(
  counts: OppfangetStatusCounts | null | undefined,
): OppfangetStatusCounts {
  if (!counts || typeof counts !== 'object') return { ...EMPTY_COUNTS };
  return {
    oppfanget: counts.oppfanget ?? 0,
    under_terskel: counts.under_terskel ?? 0,
    utkast_laget: counts.utkast_laget ?? 0,
    publisert: counts.publisert ?? 0,
    avvist: counts.avvist ?? 0,
  };
}

export function isOppfangetListResponse(value: unknown): value is OppfangetListResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as OppfangetListResponse;
  return Array.isArray(candidate.rows) && typeof candidate.tableMissing === 'boolean';
}

export function shouldShowOppfangetPipelineEmpty(
  data: OppfangetListResponse | null,
  filters: OppfangetFilterInput,
  pending: boolean,
): boolean {
  if (!data || pending || data.tableMissing) return false;
  if (data.rows.length > 0) return false;
  return !hasActiveOppfangetFilters(filters);
}

export function shouldShowOppfangetFilterEmpty(
  data: OppfangetListResponse | null,
  filters: OppfangetFilterInput,
  pending: boolean,
): boolean {
  if (!data || pending || data.tableMissing) return false;
  if (data.rows.length > 0) return false;
  return hasActiveOppfangetFilters(filters);
}
