-- Follow-up to 20261017120000, 20261017121000, 20261017130000:
-- Supabase default EXECUTE on new functions can leave anon/authenticated able to call
-- SECURITY DEFINER RPCs. Re-apply explicit grants (idempotent; safe if already fixed in prod).

-- Service-only: eligibility helper for display-name RPC (not for direct client use).
REVOKE EXECUTE ON FUNCTION public.user_has_public_display_eligibility(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_public_display_eligibility(uuid) TO service_role;

-- Public display names: keep callable from browser session (anon + authenticated).
REVOKE EXECUTE ON FUNCTION public.get_public_user_displays(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_user_displays(uuid[]) TO anon, authenticated, service_role;

-- Stance aggregates: server-only (see lib/issue-participation-totals.ts).
REVOKE EXECUTE ON FUNCTION public.get_stance_totals_batch(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_stance_totals_batch(text[]) TO service_role;

-- Political consent / Art. 9 processing: server-only.
REVOKE EXECUTE ON FUNCTION public.user_has_political_consent(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_political_consent(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_political_consent(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_political_consent(uuid, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.withdraw_political_consent(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_political_consent(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.purge_political_processing_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_political_processing_data(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.withdraw_all_political_consents(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_all_political_consents(uuid) TO service_role;
