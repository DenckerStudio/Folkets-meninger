import type { UserAnnotationTargetType } from '@/lib/user-annotations/types';

/** Stabil nøkkel for initielt hent av notater (unngår avhengighet på hele context-objektet). */
export function annotationFetchQueryKey(
  targetType: UserAnnotationTargetType,
  targetId: string,
): string {
  return `${targetType}:${targetId.trim()}`;
}