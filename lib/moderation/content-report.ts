export const CONTENT_REPORT_CATEGORIES = [
  'spam',
  'hate',
  'harassment',
  'misinformation',
  'other',
] as const;

export type ContentReportCategory = (typeof CONTENT_REPORT_CATEGORIES)[number];

/** Targets that can be reported into the shared `content_reports` table. */
export const CONTENT_REPORT_TARGETS = [
  'citizen_opinion',
  'citizen_opinion_reply',
] as const;

export type ContentReportTarget = (typeof CONTENT_REPORT_TARGETS)[number];

export function isContentReportCategory(value: string): value is ContentReportCategory {
  return (CONTENT_REPORT_CATEGORIES as readonly string[]).includes(value);
}

export function isContentReportTarget(value: string): value is ContentReportTarget {
  return (CONTENT_REPORT_TARGETS as readonly string[]).includes(value);
}

export function contentReportCategoryLabel(category: ContentReportCategory): string {
  switch (category) {
    case 'spam':
      return 'Spam';
    case 'hate':
      return 'Hatefulle ytringer';
    case 'harassment':
      return 'Trakassering';
    case 'misinformation':
      return 'Feilinformasjon';
    case 'other':
      return 'Annet';
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}
