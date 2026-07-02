-- Align denormalized ferdigbehandlet with cached detail_json when they drift.
update public.stortinget_issues
set ferdigbehandlet = (detail_json->>'ferdigbehandlet')::boolean
where detail_json ? 'ferdigbehandlet'
  and jsonb_typeof(detail_json->'ferdigbehandlet') = 'boolean'
  and ferdigbehandlet is distinct from (detail_json->>'ferdigbehandlet')::boolean;
