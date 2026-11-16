export const USER_ANNOTATION_FLAG_TYPES = [
  'viktig_argument',
  'faktasjekk',
  'kildesok',
  'motargument',
  'sporsmal',
] as const;

export type UserAnnotationFlagType = (typeof USER_ANNOTATION_FLAG_TYPES)[number];

export const USER_ANNOTATION_FLAG_LABELS: Record<UserAnnotationFlagType, string> = {
  viktig_argument: 'Viktig argument',
  faktasjekk: 'Faktasjekk',
  kildesok: 'Kildesøk',
  motargument: 'Motargument',
  sporsmal: 'Spørsmål',
};

/** Tailwind highlight + optional badge chip on list items (semantic tokens where possible). */
export const USER_ANNOTATION_FLAG_STYLES: Record<
  UserAnnotationFlagType,
  { mark: string; badge: string }
> = {
  viktig_argument: {
    mark: 'bg-amber-200/80 dark:bg-amber-500/35',
    badge: 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100',
  },
  faktasjekk: {
    mark: 'bg-sky-200/80 dark:bg-sky-500/35',
    badge: 'border-sky-500/40 bg-sky-500/10 text-sky-950 dark:text-sky-100',
  },
  kildesok: {
    mark: 'bg-emerald-200/80 dark:bg-emerald-500/35',
    badge: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100',
  },
  motargument: {
    mark: 'bg-rose-200/80 dark:bg-rose-500/35',
    badge: 'border-rose-500/40 bg-rose-500/10 text-rose-950 dark:text-rose-100',
  },
  sporsmal: {
    mark: 'bg-violet-200/80 dark:bg-violet-500/35',
    badge: 'border-violet-500/40 bg-violet-500/10 text-violet-950 dark:text-violet-100',
  },
};

export function isUserAnnotationFlagType(value: unknown): value is UserAnnotationFlagType {
  return (
    typeof value === 'string' &&
    (USER_ANNOTATION_FLAG_TYPES as readonly string[]).includes(value)
  );
}

export const DEFAULT_USER_ANNOTATION_FLAG_TYPE: UserAnnotationFlagType = 'viktig_argument';