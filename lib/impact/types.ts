export const HOUSING_TYPES = ['owner', 'renter', 'other'] as const;
export type HousingType = (typeof HOUSING_TYPES)[number];

export const OCCUPATIONS = ['student', 'employed', 'retired', 'unemployed', 'other'] as const;
export type Occupation = (typeof OCCUPATIONS)[number];

export const CAR_CHOICES = ['yes', 'no'] as const;
export type CarOwnership = (typeof CAR_CHOICES)[number];

export type ImpactProfile = {
  fylkeCode: string | null;
  housing: HousingType | null;
  hasCar: CarOwnership | null;
  occupation: Occupation | null;
};

export type ImpactDirection = 'increase' | 'decrease' | 'mixed' | 'none' | 'unknown';

export type ImpactAmountKind = 'tax' | 'fee' | 'benefit' | 'other';

export type ImpactConfidence = 'high' | 'medium' | 'low';

export type ImpactAudience =
  | 'car_owner'
  | 'no_car'
  | 'homeowner'
  | 'renter'
  | 'student'
  | 'employed'
  | 'retired'
  | 'unemployed'
  | 'county'
  | 'general';

export type ImpactChunk = {
  documentId: string;
  chunkIndex: number;
  content: string;
  score?: number;
};

export type MoneyMention = {
  amountKr: number;
  raw: string;
  period: 'year' | 'month' | 'one_time' | 'unknown';
  direction: ImpactDirection;
  kind: ImpactAmountKind;
  excerpt: string;
};

export type ImpactEffect = {
  id: string;
  title: string;
  summary: string;
  appliesToUser: boolean;
  audience: ImpactAudience;
  audienceLabel: string;
  direction: ImpactDirection;
  annualAmountKr: number | null;
  amountKind: ImpactAmountKind | null;
  evidence: string;
};

export type ImpactResult = {
  headline: string;
  personalSummary: string;
  annualAmountKr: number | null;
  direction: ImpactDirection;
  amountKind: ImpactAmountKind | null;
  confidence: ImpactConfidence;
  effects: ImpactEffect[];
  grounded: boolean;
  sourcesUsed: number;
  whoAffected: string | null;
  howAffected: string | null;
  disclaimer: string;
};

export const EMPTY_IMPACT_PROFILE: ImpactProfile = {
  fylkeCode: null,
  housing: null,
  hasCar: null,
  occupation: null,
};

export const IMPACT_DISCLAIMER =
  'Anslaget er basert på saksdokumentene og AI-sammendraget. Det er ikke skatteråd, og beløp vises bare når de finnes i kilden.';
