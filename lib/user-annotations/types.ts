import type { UserAnnotationFlagType } from '@/lib/user-annotations/flag-types';

/** Legacy `sak` rows may exist in DB but are not exposed in UI or API writes. */
export const USER_ANNOTATION_TARGET_TYPES = ['sak', 'research', 'research_topic'] as const;
export type UserAnnotationTargetType = (typeof USER_ANNOTATION_TARGET_TYPES)[number];

/** Targets admins may annotate in the research tool. */
export const USER_ANNOTATION_CREATABLE_TARGET_TYPES = ['research', 'research_topic'] as const;
export type UserAnnotationCreatableTargetType =
  (typeof USER_ANNOTATION_CREATABLE_TARGET_TYPES)[number];

export type UserAnnotationRow = {
  id: string;
  user_id: string;
  target_type: UserAnnotationTargetType;
  target_id: string;
  container_key: string;
  quote: string;
  note: string | null;
  flag_type: UserAnnotationFlagType;
  start_offset: number;
  end_offset: number;
  anchor_prefix: string | null;
  anchor_suffix: string | null;
  created_at: string;
  updated_at: string;
};

export type UserAnnotationPublic = Omit<UserAnnotationRow, 'user_id'>;

export type CreateUserAnnotationInput = {
  target_type: UserAnnotationCreatableTargetType;
  target_id: string;
  container_key: string;
  quote: string;
  note?: string | null;
  flag_type: UserAnnotationFlagType;
  start_offset: number;
  end_offset: number;
  anchor_prefix?: string | null;
  anchor_suffix?: string | null;
};

export type UpdateUserAnnotationInput = {
  note?: string | null;
  flag_type?: UserAnnotationFlagType;
};