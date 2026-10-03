/** Official party marks for parties currently in Stortinget (2025–2029). */

export const STORTINGET_PARTY_LOGOS = {
  Arbeiderpartiet: '/partier/arbeiderpartiet.png',
  Høyre: '/partier/hoyre.png',
  Senterpartiet: '/partier/senterpartiet.png',
  Fremskrittspartiet: '/partier/fremskrittspartiet.png',
  'Sosialistisk Venstreparti': '/partier/sosialistisk-venstreparti.png',
  Rødt: '/partier/rodt.png',
  Venstre: '/partier/venstre.png',
  'Kristelig Folkeparti': '/partier/kristelig-folkeparti.png',
  'Miljøpartiet De Grønne': '/partier/miljopartiet-de-gronne.png',
} as const;

export type KnownPartyName = keyof typeof STORTINGET_PARTY_LOGOS;

export function getPartyLogoSrc(partyName: string): string | null {
  if (partyName in STORTINGET_PARTY_LOGOS) {
    return STORTINGET_PARTY_LOGOS[partyName as KnownPartyName];
  }
  return null;
}

export function uniquePartyNames(partyNames: Iterable<string>): string[] {
  return [...new Set(partyNames)].filter(Boolean).sort((a, b) => a.localeCompare(b, 'no'));
}

/** Parties we would need to render, but have no real logo file for. */
export function missingPartyLogos(partyNames: Iterable<string>): string[] {
  return uniquePartyNames(partyNames).filter((name) => getPartyLogoSrc(name) === null);
}
