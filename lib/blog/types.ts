export const BLOG_POST_STATUSES = ['draft', 'approved', 'published', 'rejected'] as const;
export type BlogPostStatus = (typeof BLOG_POST_STATUSES)[number];

export const BLOG_AUTHOR_LABEL = 'Folkets Meninger';

export type BlogPostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body_md: string;
  tags: string[];
  related_sak_ids: string[];
  related_horing_ids: string[];
  status: BlogPostStatus;
  source_event: string | null;
  created_at: string;
  published_at: string | null;
  social_posted_at: string | null;
};

export type BlogPostPublic = Pick<
  BlogPostRow,
  | 'slug'
  | 'title'
  | 'excerpt'
  | 'body_md'
  | 'tags'
  | 'related_sak_ids'
  | 'related_horing_ids'
  | 'published_at'
>;
