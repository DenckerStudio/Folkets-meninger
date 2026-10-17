-- Vote receipt crypto: require a configured secret for NEW encryption; decrypt may try legacy pepper from app_settings.
-- Apply only after vote_encryption_secret is set (see supabase/README.md § Vote encryption rollout).

CREATE OR REPLACE FUNCTION private.vote_key_hex(p_user_id uuid, p_pepper text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT encode(
    extensions.digest(convert_to(p_user_id::text || p_pepper, 'UTF8'), 'sha256'::text),
    'hex'
  );
$$;

REVOKE ALL ON FUNCTION private.vote_key_hex(uuid, text) FROM PUBLIC;

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
    nullif(trim(private.get_setting('vote_encryption_secret')), ''),
    nullif(trim(current_setting('app.vote_encryption_secret', true)), '')
  );

  IF secret IS NULL OR length(secret) < 16 THEN
    RAISE EXCEPTION 'vote_encryption_secret is not configured';
  END IF;

  RETURN private.vote_key_hex(p_user_id, secret);
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_vote_choice(p_user_id uuid, p_encrypted bytea)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, private
AS $$
DECLARE
  secret text;
  legacy text;
  guc text;
  choice text;
BEGIN
  secret := nullif(trim(private.get_setting('vote_encryption_secret')), '');
  legacy := nullif(trim(private.get_setting('vote_encryption_legacy_pepper')), '');
  guc := nullif(trim(current_setting('app.vote_encryption_secret', true)), '');

  IF secret IS NOT NULL AND length(secret) >= 16 THEN
    BEGIN
      choice := extensions.pgp_sym_decrypt(p_encrypted, private.vote_key_hex(p_user_id, secret));
      RETURN choice;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  IF guc IS NOT NULL AND length(guc) >= 16 AND guc IS DISTINCT FROM secret THEN
    BEGIN
      choice := extensions.pgp_sym_decrypt(p_encrypted, private.vote_key_hex(p_user_id, guc));
      RETURN choice;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  IF legacy IS NOT NULL AND length(legacy) >= 1 THEN
    BEGIN
      choice := extensions.pgp_sym_decrypt(p_encrypted, private.vote_key_hex(p_user_id, legacy));
      RETURN choice;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  RAISE EXCEPTION 'Could not decrypt vote choice (missing or wrong vote_encryption_secret / vote_encryption_legacy_pepper)';
END;
$$;

COMMENT ON FUNCTION public.decrypt_vote_choice(uuid, bytea) IS
  'Decrypts sak/poll vote receipts. Tries vote_encryption_secret, then app GUC, then vote_encryption_legacy_pepper for pre-rotation ciphertext.';
