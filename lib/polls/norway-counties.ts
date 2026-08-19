/** Norway's 15 counties (fylker) after the 2024 regional reform. */
export const NORWAY_COUNTIES = [
  { code: '03', name: 'Oslo', sortOrder: 1 },
  { code: '11', name: 'Rogaland', sortOrder: 2 },
  { code: '15', name: 'Møre og Romsdal', sortOrder: 3 },
  { code: '18', name: 'Nordland', sortOrder: 4 },
  { code: '31', name: 'Østfold', sortOrder: 5 },
  { code: '32', name: 'Akershus', sortOrder: 6 },
  { code: '33', name: 'Buskerud', sortOrder: 7 },
  { code: '34', name: 'Innlandet', sortOrder: 8 },
  { code: '39', name: 'Vestfold', sortOrder: 9 },
  { code: '40', name: 'Telemark', sortOrder: 10 },
  { code: '42', name: 'Agder', sortOrder: 11 },
  { code: '46', name: 'Vestland', sortOrder: 12 },
  { code: '50', name: 'Trøndelag', sortOrder: 13 },
  { code: '55', name: 'Troms', sortOrder: 14 },
  { code: '56', name: 'Finnmark', sortOrder: 15 },
] as const;

export type NorwayCountyCode = (typeof NORWAY_COUNTIES)[number]['code'];

const CODE_SET = new Set<string>(NORWAY_COUNTIES.map((c) => c.code));

export function isNorwayCountyCode(value: string | null | undefined): value is NorwayCountyCode {
  return typeof value === 'string' && CODE_SET.has(value);
}

export function countyName(code: string | null | undefined): string | null {
  if (!code) return null;
  return NORWAY_COUNTIES.find((c) => c.code === code)?.name ?? null;
}

/** Minimum ballots per county before regional results are shown (k-anonymity). */
export const POLL_FYLKE_MIN_VOTES = 5;

/** Default support threshold for citizen initiatives to become national polls. */
export const CITIZEN_INITIATIVE_DEFAULT_THRESHOLD = 500;
