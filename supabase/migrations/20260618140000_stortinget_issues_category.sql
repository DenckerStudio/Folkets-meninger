-- Denormalized list field for fast sak-list queries without Stortinget bulk API.
ALTER TABLE public.stortinget_issues
  ADD COLUMN IF NOT EXISTS category text;

CREATE INDEX IF NOT EXISTS idx_stortinget_issues_list_cache
  ON public.stortinget_issues (sak_kind, last_synced_at DESC)
  WHERE sak_kind IS NOT NULL;

COMMENT ON COLUMN public.stortinget_issues.category IS 'Emne/kategori fra Stortinget (emne_liste) eller avledet sakstype';
