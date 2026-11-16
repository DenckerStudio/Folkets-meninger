import { getServerSupabase } from '@/lib/supabase-server';
import { isRedditSignalsFixturePreviewAllowed } from '@/lib/reddit-signals/preview';
import {
  buildRedditSpikeBadgeFixture,
  parseSpikeBadgeConfigValue,
  REDDIT_SPIKE_BADGE_CONFIG_KEY,
  type RedditSpikeBadgeView,
} from '@/lib/reddit-signals/spike-badge';

function isMissingIngestConfigTable(error: { message?: string } | null): boolean {
  if (!error) return false;
  return /reddit_ingest_config|does not exist|undefined_table/i.test(error.message ?? '');
}

export async function loadRedditSpikeBadgeForAdmin(
  previewParam?: string | null,
): Promise<RedditSpikeBadgeView | null> {
  if (isRedditSignalsFixturePreviewAllowed(previewParam)) {
    return buildRedditSpikeBadgeFixture();
  }
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('reddit_ingest_config')
    .select('value')
    .eq('key', REDDIT_SPIKE_BADGE_CONFIG_KEY)
    .maybeSingle();

  if (error) {
    if (isMissingIngestConfigTable(error)) return null;
    return null;
  }
  if (!data) return null;

  return parseSpikeBadgeConfigValue(data.value);
}