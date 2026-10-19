-- Aksjonsfangst (fase 2): klynger og kilder. RPC-er og polls-kolonner kommer i senere migrasjoner.
-- Må kjøres manuelt på supabase-folkets før merge til main (fm-web auto-deploy).

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.action_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key text NOT NULL UNIQUE,
  action_type text NOT NULL CHECK (
    action_type IN ('boykott', 'opprop', 'demonstrasjon', 'innsamling', 'kampanje')
  ),
  action_name text NOT NULL,
  topic text,
  target text,
  target_kind text,
  description_nb text NOT NULL,
  sensitive_category text,
  status text NOT NULL DEFAULT 'candidate' CHECK (
    status IN (
      'candidate',
      'below_threshold',
      'manual_only',
      'blocked',
      'would_draft',
      'drafted',
      'rejected',
      'not_action'
    )
  ),
  verdict_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  independent_publishers text[] NOT NULL DEFAULT '{}',
  national_coverage boolean NOT NULL DEFAULT false,
  max_confidence numeric(3, 2),
  best_scale jsonb,
  related_issue_id text REFERENCES public.stortinget_issues (id) ON DELETE SET NULL,
  related_similarity numeric(4, 3),
  poll_id uuid REFERENCES public.polls (id) ON DELETE SET NULL,
  reject_reason text,
  decided_by uuid REFERENCES auth.users (id),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS action_clusters_status_last_seen_idx
  ON public.action_clusters (status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS action_clusters_poll_id_idx
  ON public.action_clusters (poll_id)
  WHERE poll_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.action_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.action_clusters (id) ON DELETE CASCADE,
  item_key text NOT NULL UNIQUE,
  url_canonical text NOT NULL,
  source_type text CHECK (source_type IN ('news_rss', 'reddit', 'petition', 'searxng')),
  publisher text,
  signal_only boolean NOT NULL DEFAULT false,
  title text,
  excerpt varchar(300),
  published_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  status text,
  confidence numeric(3, 2),
  classification jsonb
);

CREATE INDEX IF NOT EXISTS action_sources_cluster_id_idx
  ON public.action_sources (cluster_id);

CREATE INDEX IF NOT EXISTS action_sources_publisher_idx
  ON public.action_sources (publisher)
  WHERE publisher IS NOT NULL;

REVOKE ALL ON TABLE public.action_clusters FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.action_sources FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.action_clusters TO service_role;
GRANT ALL ON TABLE public.action_sources TO service_role;

ALTER TABLE public.action_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS action_clusters_admin_read ON public.action_clusters;
CREATE POLICY action_clusters_admin_read ON public.action_clusters
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS action_sources_admin_read ON public.action_sources;
CREATE POLICY action_sources_admin_read ON public.action_sources
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

GRANT SELECT ON TABLE public.action_clusters TO authenticated;
GRANT SELECT ON TABLE public.action_sources TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
