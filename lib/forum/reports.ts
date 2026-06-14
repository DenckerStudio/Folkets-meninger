export const FORUM_REPORT_CATEGORIES = [
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Trakassering eller hat' },
  { id: 'misinformation', label: 'Feil informasjon' },
  { id: 'other', label: 'Annet' },
] as const;

export type ForumReportCategory = (typeof FORUM_REPORT_CATEGORIES)[number]['id'];

const CATEGORY_SET = new Set<string>(FORUM_REPORT_CATEGORIES.map((c) => c.id));

export function isValidReportCategory(value: unknown): value is ForumReportCategory {
  return typeof value === 'string' && CATEGORY_SET.has(value);
}

export function isDuplicateReportError(code: string | undefined): boolean {
  return code === '23505';
}

const categoryLabels = Object.fromEntries(
  FORUM_REPORT_CATEGORIES.map((c) => [c.id, c.label]),
);

export function reportCategoryLabel(category: string | null): string {
  if (!category) return 'Ukjent';
  return categoryLabels[category] ?? category;
}

export type ForumReportListItem = {
  id: string;
  targetType: 'thread' | 'reply';
  targetId: string;
  category: string | null;
  reason: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  targetTitle: string;
  targetExcerpt: string;
  targetAuthorName: string | null;
  threadId: string;
};
