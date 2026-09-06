export const DISCUSSION_BODY_MIN = 1;
export const DISCUSSION_BODY_MAX = 4000;
export const DISCUSSION_PAGE_SIZE_DEFAULT = 50;
export const DISCUSSION_PAGE_SIZE_MAX = 50;

export type DiscussionPostRecord = {
  id: string;
  body: string;
  createdAt: string;
  authorUserId: string;
  authorName: string | null;
  authorInitials: string;
};

export type DiscussionPostsPage = {
  posts: DiscussionPostRecord[];
  nextCursor: string | null;
};

export const CONTENT_REPORT_CATEGORIES = [
  'spam',
  'hate',
  'harassment',
  'misinformation',
  'other',
] as const;

export type ContentReportCategory = (typeof CONTENT_REPORT_CATEGORIES)[number];
