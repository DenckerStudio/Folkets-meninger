export const ACTIVITY_VISIBILITY_VALUES = ['private', 'summary', 'full'] as const;

export type ActivityVisibility = (typeof ACTIVITY_VISIBILITY_VALUES)[number];

export function parseActivityVisibility(value: unknown): ActivityVisibility {
  if (typeof value === 'string' && (ACTIVITY_VISIBILITY_VALUES as readonly string[]).includes(value)) {
    return value as ActivityVisibility;
  }
  return 'private';
}

export function activityVisibilityLabel(value: ActivityVisibility): string {
  switch (value) {
    case 'private':
      return 'Privat';
    case 'summary':
      return 'Kun sammendrag';
    case 'full':
      return 'All aktivitet';
    default: {
      const _exhaustive: never = value;
      return _exhaustive;
    }
  }
}
