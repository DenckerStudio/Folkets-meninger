import type { SakArgumentItem } from '@/lib/sak/arguments/types';

/** Innstillingstekst is mostly procedural boilerplate; stance lines live in merknader or meninger. */
export function extractInnstillingArguments(
  _innstillingstekst: string | null | undefined,
): SakArgumentItem[] {
  return [];
}