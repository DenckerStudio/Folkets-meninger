-- Blog posts for /blogg (SEO + n8n draft pipeline).
-- NOT applied automatically by this repo change — run manually on Coolify Postgres when ready.

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  body_md text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  related_sak_ids text[] NOT NULL DEFAULT '{}',
  related_horing_ids text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  source_event text,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  social_posted_at timestamptz,
  CONSTRAINT blog_posts_slug_key UNIQUE (slug),
  CONSTRAINT blog_posts_status_check CHECK (
    status IN ('draft', 'approved', 'published', 'rejected')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_source_event_key
  ON public.blog_posts (source_event)
  WHERE source_event IS NOT NULL;

CREATE INDEX IF NOT EXISTS blog_posts_status_published_idx
  ON public.blog_posts (status, published_at DESC NULLS LAST);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.blog_posts FROM PUBLIC;
REVOKE ALL ON TABLE public.blog_posts FROM anon;
REVOKE ALL ON TABLE public.blog_posts FROM authenticated;

GRANT SELECT ON TABLE public.blog_posts TO anon;
GRANT SELECT ON TABLE public.blog_posts TO authenticated;
GRANT ALL ON TABLE public.blog_posts TO service_role;

DROP POLICY IF EXISTS blog_posts_public_read ON public.blog_posts;
CREATE POLICY blog_posts_public_read
  ON public.blog_posts
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');
