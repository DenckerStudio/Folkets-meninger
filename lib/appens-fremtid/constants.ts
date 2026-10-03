export const APPENS_FREMTID_TITLE = 'Appens fremtid';

export const SUGGESTION_TITLE_MIN = 8;
export const SUGGESTION_TITLE_MAX = 80;
export const SUGGESTION_BODY_MIN = 20;
export const SUGGESTION_BODY_MAX = 800;

export const CHANGELOG_TITLE_MIN = 4;
export const CHANGELOG_TITLE_MAX = 80;
export const CHANGELOG_BODY_MIN = 10;
export const CHANGELOG_BODY_MAX = 2000;

export const ROADMAP_TITLE_MIN = 4;
export const ROADMAP_TITLE_MAX = 80;
export const ROADMAP_BODY_MIN = 10;
export const ROADMAP_BODY_MAX = 1000;

export const SUGGESTION_CATEGORIES = ['funksjon', 'innhold', 'feil', 'annet'] as const;
export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number];

export const SUGGESTION_AUDIENCES = ['alle', 'innloggede', 'admin', 'meg'] as const;
export type SuggestionAudience = (typeof SUGGESTION_AUDIENCES)[number];

export const SUGGESTION_STATUSES = ['new', 'handled'] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export const SUGGESTION_VOTES = ['up', 'down'] as const;
export type SuggestionVote = (typeof SUGGESTION_VOTES)[number];

export const ROADMAP_STATUSES = ['planned', 'in_progress', 'done'] as const;
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

export type SuggestionRecord = {
  id: string;
  userId: string;
  title: string;
  body: string;
  category: SuggestionCategory;
  audience: SuggestionAudience;
  status: SuggestionStatus;
  votingOpen: boolean;
  createdAt: string;
  handledAt: string | null;
  handledBy: string | null;
  authorName: string | null;
  upCount: number;
  downCount: number;
  myVote: SuggestionVote | null;
};

export type ChangelogEntry = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  publishedAt: string | null;
};

export type RoadmapItem = {
  id: string;
  title: string;
  body: string;
  status: RoadmapStatus;
  sortOrder: number;
  createdAt: string;
};

export function isSuggestionCategory(value: unknown): value is SuggestionCategory {
  return SUGGESTION_CATEGORIES.includes(value as SuggestionCategory);
}

export function isSuggestionAudience(value: unknown): value is SuggestionAudience {
  return SUGGESTION_AUDIENCES.includes(value as SuggestionAudience);
}

export function isSuggestionStatus(value: unknown): value is SuggestionStatus {
  return value === 'new' || value === 'handled';
}

export function isSuggestionVote(value: unknown): value is SuggestionVote {
  return value === 'up' || value === 'down';
}

export function isRoadmapStatus(value: unknown): value is RoadmapStatus {
  return ROADMAP_STATUSES.includes(value as RoadmapStatus);
}

export function suggestionStatusLabel(status: SuggestionStatus): string {
  switch (status) {
    case 'new':
      return 'Ny';
    case 'handled':
      return 'Behandlet';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function suggestionCategoryLabel(category: SuggestionCategory): string {
  switch (category) {
    case 'funksjon':
      return 'Ny funksjon';
    case 'innhold':
      return 'Innhold';
    case 'feil':
      return 'Feil';
    case 'annet':
      return 'Annet';
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}

export function suggestionAudienceLabel(audience: SuggestionAudience): string {
  switch (audience) {
    case 'alle':
      return 'Alle';
    case 'innloggede':
      return 'Innloggede';
    case 'admin':
      return 'Administratorer';
    case 'meg':
      return 'Meg / få personer';
    default: {
      const _exhaustive: never = audience;
      return _exhaustive;
    }
  }
}

export function roadmapStatusLabel(status: RoadmapStatus): string {
  switch (status) {
    case 'planned':
      return 'Planlagt';
    case 'in_progress':
      return 'Under arbeid';
    case 'done':
      return 'Ferdig';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export const ROADMAP_STATUS_ORDER: RoadmapStatus[] = ['in_progress', 'planned', 'done'];
