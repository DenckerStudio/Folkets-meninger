export const BLOG_AUTHOR_LABEL = 'Folkets Meninger';

export type BlogAuthorSummary = {
  name: string;
  slug: string;
  kind: 'person' | 'organization';
  role: string | null;
  bio: string | null;
};

export type BlogPostPublic = {
  slug: string;
  title: string;
  excerpt: string;
  body_md: string;
  tags: string[];
  related_sak_ids: string[];
  related_horing_ids: string[];
  published_at: string | null;
  updated_at: string | null;
  category_slug: string | null;
  category_name: string | null;
  featured: boolean;
  hero_image_url: string | null;
  reading_time_minutes: number;
  authors: BlogAuthorSummary[];
  ai_assisted: boolean;
  ai_model_family: string | null;
  seo_title: string | null;
  seo_description: string | null;
  author_label: string;
};

export type BlogPostListItem = BlogPostPublic & { id: string };

export type BlogCategory = {
  name: string;
  slug: string;
  description?: string | null;
  order: number;
};

export const BLOG_PAGE_SIZE = 9;
