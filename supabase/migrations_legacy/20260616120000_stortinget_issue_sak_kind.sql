-- Debatt- og stemmevennlige saker: metadata fra Stortingets API for filtrering og visning
ALTER TABLE public.stortinget_issues
  ADD COLUMN IF NOT EXISTS dokumentgruppe smallint,
  ADD COLUMN IF NOT EXISTS henvisning text,
  ADD COLUMN IF NOT EXISTS sak_kind text;

ALTER TABLE public.stortinget_issues
  DROP CONSTRAINT IF EXISTS stortinget_issues_sak_kind_check;

ALTER TABLE public.stortinget_issues
  ADD CONSTRAINT stortinget_issues_sak_kind_check
  CHECK (sak_kind IS NULL OR sak_kind IN ('lovforslag', 'representantforslag'));

CREATE INDEX IF NOT EXISTS idx_stortinget_issues_sak_kind
  ON public.stortinget_issues (sak_kind)
  WHERE sak_kind IS NOT NULL;

COMMENT ON COLUMN public.stortinget_issues.sak_kind IS 'Debatt- og stemmevennlig sakstype: lovforslag eller representantforslag';
COMMENT ON COLUMN public.stortinget_issues.dokumentgruppe IS 'Stortinget dokumentgruppe fra /eksport/saker';
COMMENT ON COLUMN public.stortinget_issues.henvisning IS 'Stortinget henvisning (f.eks. Prop. 103 L eller Dokument 8:302)';
