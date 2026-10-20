export type PayloadListResponse<T> = {
  docs: T[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
};

export type PayloadCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  order?: number | null;
};

export type PayloadTag = {
  id: string;
  name: string;
  slug: string;
};

export type PayloadAuthor = {
  id: string;
  name: string;
  slug: string;
  kind?: 'person' | 'organization' | null;
  role?: string | null;
  bio?: string | null;
  avatar?: PayloadMedia | string | null;
};

export type PayloadMedia = {
  id: string;
  url?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  sizes?: {
    card?: { url?: string | null };
    hero?: { url?: string | null };
    og?: { url?: string | null };
  };
};

export type PayloadPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  featured?: boolean | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string;
  updatedAtDisplay?: string | null;
  readingTimeMinutes?: number | null;
  category?: PayloadCategory | string | null;
  tags?: Array<PayloadTag | string> | null;
  authors?: Array<PayloadAuthor | string> | null;
  relatedSakIds?: Array<{ id: string }> | null;
  relatedHoringIds?: Array<{ id: string }> | null;
  heroImage?: PayloadMedia | string | null;
  ai?: {
    assisted?: boolean | null;
    modelFamily?: string | null;
  } | null;
  seo?: {
    metaTitle?: string | null;
    metaDescription?: string | null;
    noindex?: boolean | null;
  } | null;
  social?: {
    blueskyText?: string | null;
    socialPostedAt?: string | null;
    blueskyUri?: string | null;
  } | null;
  sourceEvent?: string | null;
  _status?: 'draft' | 'published';
};
