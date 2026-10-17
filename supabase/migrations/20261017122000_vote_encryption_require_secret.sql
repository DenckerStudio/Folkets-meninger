-- C1: never derive vote keys from a public repo fallback pepper.

CREATE OR REPLACE FUNCTION public.vote_encryption_key(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, private
AS $$
DECLARE
  secret text;
BEGIN
  secret := coalesce(
    private.get_setting('vote_encryption_secret'),
    nullif(current_setting('app.vote_encryption_secret', true), '')
  );

  IF secret IS NULL OR length(trim(secret)) < 16 THEN
    RAISE EXCEPTION 'vote_encryption_secret is not configured';
  END IF;

  RETURN encode(
    extensions.digest(
      convert_to(p_user_id::text || secret, 'UTF8'),
      'sha256'::text
    ),
    'hex'
  );
END;
$$;
