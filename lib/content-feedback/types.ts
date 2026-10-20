/** DB-typer for content_feedback / kilder (F1). Speiler supabase/migrations/20261021120000_content_feedback.sql */

/** bge-m3 (Mathias' team — ikke nomic 768) */
export const CONTENT_FEEDBACK_EMBEDDING_DIM = 1024;
export const CONTENT_FEEDBACK_EMBEDDING_MODEL = 'bge-m3';

export type ContentFeedbackType =
  | 'reel'
  | 'ai_summary'
  | 'blog_post'
  | 'poll'
  | 'action'
  | 'source_item';

export type ContentFeedbackVerdict = 'approve' | 'reject' | 'neutral';

export type ContentFeedbackSource = 'admin' | 'historic' | 'auto';

/** Aspektmerker: «+» / «-» / null (uprettet) */
export type ContentFeedbackAspects = Partial<
  Record<
    | 'title'
    | 'description'
    | 'sources'
    | 'topic'
    | 'tone'
    | 'relevance'
    | 'timing'
    | 'language',
    '+' | '-' | null
  >
>;

export type ContentSourceTier = 'primary' | 'normal' | 'signal_only' | 'blocked';

export type ContentFeedbackRow = {
  id: string;
  content_type: ContentFeedbackType;
  content_id: string;
  verdict: ContentFeedbackVerdict;
  aspects: ContentFeedbackAspects;
  reason_tags: string[];
  note: string | null;
  snapshot: Record<string, unknown>;
  embedding: string | null;
  source: ContentFeedbackSource;
  admin_id: string | null;
  created_at: string;
  superseded_at: string | null;
};

export type ContentSourceRow = {
  domain: string;
  tier: ContentSourceTier;
  base_weight: number;
  learned_weight: number | null;
  ingest: Record<string, unknown>;
};

export type SourceItemRow = {
  id: string;
  domain: string;
  external_id: string;
  url: string;
  title: string;
  excerpt: string | null;
  categories: string[];
  published_at: string | null;
  fetched_at: string;
  modified_at: string;
  embedding: string | null;
  embedding_model: string | null;
};

export type FeedbackProfileRow = {
  content_type: ContentFeedbackType;
  profile: Record<string, unknown>;
  calibration: Record<string, unknown>;
  updated_at: string;
};

export type UpsertContentFeedbackArgs = {
  p_content_type: ContentFeedbackType;
  p_content_id: string;
  p_verdict: ContentFeedbackVerdict;
  p_aspects?: ContentFeedbackAspects;
  p_reason_tags?: string[];
  p_note?: string | null;
  p_admin_id?: string | null;
  p_snapshot?: Record<string, unknown>;
};

export type N8nFeedbackSimilarityResult = {
  content_type: ContentFeedbackType;
  max_sim_approved: number;
  max_sim_rejected: number;
  n_rejected_similar: number;
};

export type N8nUpsertSourceItemsSkippedItem = {
  index: number;
  external_id: string | null;
  reason: string;
};

/** jsonb fra `n8n_upsert_source_items` */
export type N8nUpsertSourceItemsResult = {
  upserted: number;
  skipped: N8nUpsertSourceItemsSkippedItem[];
};

export type LogBlogContentFeedbackStatus =
  | 'inserted'
  | 'updated'
  | 'duplicate'
  | 'stale'
  | 'skipped_admin';

/** jsonb fra `log_blog_content_feedback` */
export type LogBlogContentFeedbackResult = {
  status: LogBlogContentFeedbackStatus;
  id: string;
};

export type N8nMatchSourceItemRow = {
  id: string;
  domain: string;
  external_id: string;
  url: string;
  title: string;
  excerpt: string | null;
  categories: string[];
  published_at: string | null;
  tier: ContentSourceTier;
  base_weight: number;
  similarity: number;
};
