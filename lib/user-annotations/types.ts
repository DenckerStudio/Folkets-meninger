export const USER_ANNOTATION_TARGET_TYPES = ['sak', 'research'] as const;
export type UserAnnotationTargetType = (typeof USER_ANNOTATION_TARGET_TYPES)[number];

export type UserAnnotationRow = {
  id: string;
  user_id: string;
  target_type: UserAnnotationTargetType;
  target_id: string;
  container_key: string;
  quote: string;
  note: string | null;
  start_offset: number;
  end_offset: number;
  anchor_prefix: string | null;
  anchor_suffix: string | null;
  created_at: string;
  updated_at: string;
};

export type UserAnnotationPublic = Omit<UserAnnotationRow, 'user_id'>;

export type CreateUserAnnotationInput = {
  target_type: UserAnnotationTargetType;
  target_id: string;
  container_key: string;
  quote: string;
  note?: string | null;
  start_offset: number;
  end_offset: number;
  anchor_prefix?: string | null;
  anchor_suffix?: string | null;
};

export type UpdateUserAnnotationInput = {
  note?: string | null;
};