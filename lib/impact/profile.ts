import { NORWAY_COUNTIES, isNorwayCountyCode } from '@/lib/polls/norway-counties';
import {
  CAR_CHOICES,
  EMPTY_IMPACT_PROFILE,
  HOUSING_TYPES,
  OCCUPATIONS,
  type CarOwnership,
  type HousingType,
  type ImpactProfile,
  type Occupation,
} from './types';

export const HOUSING_OPTIONS: { value: HousingType; label: string }[] = [
  { value: 'owner', label: 'Eier bolig' },
  { value: 'renter', label: 'Leier' },
  { value: 'other', label: 'Annet / bor hos andre' },
];

export const OCCUPATION_OPTIONS: { value: Occupation; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'employed', label: 'Yrkesaktiv' },
  { value: 'retired', label: 'Pensjonist' },
  { value: 'unemployed', label: 'Arbeidssøker' },
  { value: 'other', label: 'Annet' },
];

export const CAR_OPTIONS: { value: CarOwnership; label: string }[] = [
  { value: 'yes', label: 'Har bil' },
  { value: 'no', label: 'Har ikke bil' },
];

export { NORWAY_COUNTIES };

function isHousingType(value: unknown): value is HousingType {
  return typeof value === 'string' && (HOUSING_TYPES as readonly string[]).includes(value);
}

function isOccupation(value: unknown): value is Occupation {
  return typeof value === 'string' && (OCCUPATIONS as readonly string[]).includes(value);
}

function isCarOwnership(value: unknown): value is CarOwnership {
  return typeof value === 'string' && (CAR_CHOICES as readonly string[]).includes(value);
}

export function parseImpactProfile(input: unknown): ImpactProfile {
  if (!input || typeof input !== 'object') return { ...EMPTY_IMPACT_PROFILE };
  const row = input as Record<string, unknown>;
  const fylkeRaw = typeof row.fylkeCode === 'string' ? row.fylkeCode : null;

  return {
    fylkeCode: fylkeRaw && isNorwayCountyCode(fylkeRaw) ? fylkeRaw : null,
    housing: isHousingType(row.housing) ? row.housing : null,
    hasCar: isCarOwnership(row.hasCar) ? row.hasCar : null,
    occupation: isOccupation(row.occupation) ? row.occupation : null,
  };
}

export function hasAnyImpactParam(profile: ImpactProfile): boolean {
  return Boolean(profile.fylkeCode || profile.housing || profile.hasCar || profile.occupation);
}

export function describeProfile(profile: ImpactProfile): string[] {
  const parts: string[] = [];
  if (profile.fylkeCode) {
    const county = NORWAY_COUNTIES.find((c) => c.code === profile.fylkeCode);
    if (county) parts.push(county.name);
  }
  if (profile.housing) {
    const opt = HOUSING_OPTIONS.find((o) => o.value === profile.housing);
    if (opt) parts.push(opt.label.toLowerCase());
  }
  if (profile.hasCar) {
    parts.push(profile.hasCar === 'yes' ? 'bileier' : 'uten bil');
  }
  if (profile.occupation) {
    const opt = OCCUPATION_OPTIONS.find((o) => o.value === profile.occupation);
    if (opt) parts.push(opt.label.toLowerCase());
  }
  return parts;
}

export function housingLabel(value: HousingType): string {
  switch (value) {
    case 'owner':
      return 'boligeier';
    case 'renter':
      return 'leietaker';
    case 'other':
      return 'bosatt uten egen bolig';
    default: {
      const _exhaustive: never = value;
      return _exhaustive;
    }
  }
}

export function occupationLabel(value: Occupation): string {
  switch (value) {
    case 'student':
      return 'student';
    case 'employed':
      return 'yrkesaktiv';
    case 'retired':
      return 'pensjonist';
    case 'unemployed':
      return 'arbeidssøker';
    case 'other':
      return 'annen livssituasjon';
    default: {
      const _exhaustive: never = value;
      return _exhaustive;
    }
  }
}
