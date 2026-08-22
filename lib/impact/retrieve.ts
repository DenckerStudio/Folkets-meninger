import { countyName } from '@/lib/polls/norway-counties';
import { occupationLabel, housingLabel } from './profile';
import type { ImpactAudience, ImpactChunk, ImpactProfile } from './types';

const ECONOMIC_TERMS = [
  'avgift',
  'skatt',
  'kroner',
  ' kr',
  'støtte',
  'subsid',
  'gebyr',
  'kutt',
  'økning',
  'redus',
  'inntekt',
  'kostnad',
  'fradrag',
  'refusjon',
  'trygd',
  'ytelse',
  'egenandel',
  'bompenger',
  'formue',
];

const AUDIENCE_TERMS: Record<Exclude<ImpactAudience, 'county' | 'general' | 'no_car'>, string[]> = {
  car_owner: [
    'bil',
    'kjøretøy',
    'elbil',
    'bensin',
    'diesel',
    'veibruksavgift',
    'engangsavgift',
    'trafikkforsikring',
    'bompenger',
    'førerkort',
    'motorvogn',
  ],
  homeowner: [
    'boligeier',
    'eierbolig',
    'selveier',
    'huseier',
    'eiendomsskatt',
    'dokumentavgift',
    'formuesskatt',
    'boliglån',
    'borettslag',
  ],
  renter: ['leietaker', 'leieboer', 'husleie', 'utleie', 'leiepris', 'leiebolig'],
  student: ['student', 'studenter', 'studiestøtte', 'lånekassen', 'utdanning', 'lærling'],
  employed: ['yrkesaktiv', 'arbeidstaker', 'lønn', 'arbeidsgiveravgift', 'inntektsskatt', 'arbeidsliv'],
  retired: ['pensjonist', 'pensjon', 'alderspensjon', 'trygdede'],
  unemployed: ['arbeidsledig', 'dagpenger', 'arbeidssøker', 'nav-ytelse'],
};

export function profileAudiences(profile: ImpactProfile): ImpactAudience[] {
  const audiences: ImpactAudience[] = ['general'];
  if (profile.hasCar === 'yes') audiences.push('car_owner');
  if (profile.hasCar === 'no') audiences.push('no_car');
  if (profile.housing === 'owner') audiences.push('homeowner');
  if (profile.housing === 'renter') audiences.push('renter');
  if (profile.occupation === 'student') audiences.push('student');
  if (profile.occupation === 'employed') audiences.push('employed');
  if (profile.occupation === 'retired') audiences.push('retired');
  if (profile.occupation === 'unemployed') audiences.push('unemployed');
  if (profile.fylkeCode) audiences.push('county');
  return audiences;
}

export function profileSearchTerms(profile: ImpactProfile): string[] {
  const terms = new Set<string>(ECONOMIC_TERMS);
  const audiences = profileAudiences(profile);

  for (const audience of audiences) {
    if (audience === 'general' || audience === 'county' || audience === 'no_car') continue;
    for (const term of AUDIENCE_TERMS[audience]) terms.add(term);
  }

  const fylke = countyName(profile.fylkeCode);
  if (fylke) {
    terms.add(fylke.toLowerCase());
  }

  return [...terms];
}

function termHits(haystack: string, terms: string[]): number {
  let hits = 0;
  for (const term of terms) {
    if (haystack.includes(term)) hits += 1;
  }
  return hits;
}

export function scoreChunkForProfile(content: string, profile: ImpactProfile): number {
  const haystack = content.toLowerCase();
  const economicHits = termHits(haystack, ECONOMIC_TERMS);
  const profileTerms = profileSearchTerms(profile).filter((t) => !ECONOMIC_TERMS.includes(t));
  const profileHits = termHits(haystack, profileTerms);
  const moneyHit = /\d[\d\s.,]*\s*(kr|kroner|nok)/i.test(content) ? 3 : 0;
  return economicHits + profileHits * 2 + moneyHit;
}

export function retrieveRelevantChunks(
  chunks: ImpactChunk[],
  profile: ImpactProfile,
  limit = 8,
): ImpactChunk[] {
  const ranked = chunks
    .map((chunk) => ({
      ...chunk,
      score: scoreChunkForProfile(chunk.content, profile),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.chunkIndex - b.chunkIndex);

  const picked = ranked.slice(0, limit);
  if (picked.length > 0) return picked;

  return chunks.slice(0, Math.min(4, chunks.length)).map((chunk) => ({
    ...chunk,
    score: 0,
  }));
}

export function audienceLabel(audience: ImpactAudience, profile: ImpactProfile): string {
  switch (audience) {
    case 'car_owner':
      return 'Bileiere';
    case 'no_car':
      return 'Uten bil';
    case 'homeowner':
      return 'Boligeiere';
    case 'renter':
      return 'Leietakere';
    case 'student':
      return 'Studenter';
    case 'employed':
      return 'Yrkesaktive';
    case 'retired':
      return 'Pensjonister';
    case 'unemployed':
      return 'Arbeidssøkere';
    case 'county':
      return countyName(profile.fylkeCode) ?? 'Ditt fylke';
    case 'general':
      return 'Alle';
    default: {
      const _exhaustive: never = audience;
      return _exhaustive;
    }
  }
}

export function userSituationPhrase(profile: ImpactProfile): string {
  const bits: string[] = [];
  if (profile.occupation) bits.push(occupationLabel(profile.occupation));
  if (profile.housing) bits.push(housingLabel(profile.housing));
  if (profile.hasCar === 'yes') bits.push('bileier');
  if (profile.hasCar === 'no') bits.push('uten bil');
  const fylke = countyName(profile.fylkeCode);
  if (fylke) bits.push(`bosatt i ${fylke}`);
  if (bits.length === 0) return 'deg';
  if (bits.length === 1) return bits[0];
  return `${bits.slice(0, -1).join(', ')} og ${bits[bits.length - 1]}`;
}
