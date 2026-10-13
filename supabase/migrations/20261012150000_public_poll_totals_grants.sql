-- Public Ja/Nei/Blank aggregates for guests and signed-in users.
--
-- get_poll_totals / get_poll_totals_by_fylke are SECURITY DEFINER functions that
-- return only anonymous counts (no voter identity). The by-fylke variant applies
-- the p_min_votes floor server-side, so small cells never leak. Granting EXECUTE
-- to anon/authenticated lets the public Avstemninger/Utforsk pages and the
-- Stemme+ chat read totals through the request session instead of the service
-- role. Writes (cast_poll_vote) and encryption helpers stay service_role-only.

GRANT EXECUTE ON FUNCTION public.get_poll_totals(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_poll_totals_by_fylke(uuid, int) TO anon, authenticated;
