import type { OppfangetFilterInput } from '@/lib/admin/oppfanget/filters';
import type { OppfangetDisplayStatus, OppfangetDisplayType } from '@/lib/admin/oppfanget/types';
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

function parseDisplayStatus(value: string | undefined): OppfangetDisplayStatus | '' {
  if (!value) return '';
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
    status: parseDisplayStatus(pick('status')),
    source: pick('source'),
    dateFrom: pick('dateFrom'),
    dateTo: pick('dateTo'),
    q: pick('q'),
  };
}
