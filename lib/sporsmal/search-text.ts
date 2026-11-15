import type { StortingetSporsmal } from '@/lib/stortinget-sporsmal';
import { getSporsmalTitle } from '@/lib/stortinget-sporsmal';

/** Text fields used for free-text search (title + body). */
export function getSporsmalSearchText(item: StortingetSporsmal): string {
  const body = typeof item.sporsmal === 'string' ? item.sporsmal.trim() : '';
  const title = getSporsmalTitle(item);
  if (body && body !== title) {
    return `${title}\n${body}`.trim();
  }
  return title.trim();
}

export function getSporsmalPartyName(item: StortingetSporsmal): string | null {
  const name = item.sporsmal_fra?.parti?.navn?.trim();
  return name || null;
}

export function getSporsmalPartyId(item: StortingetSporsmal): string | null {
  const id = item.sporsmal_fra?.parti?.id?.trim();
  return id || null;
}

export function getSporsmalFraId(item: StortingetSporsmal): string | null {
  const id = item.sporsmal_fra?.id?.trim();
  return id || null;
}