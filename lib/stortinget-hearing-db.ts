import { getAnonSupabase } from '@/lib/supabase';
import type { StortingetHoring } from '@/lib/stortinget-horinger';

type HearingDbRow = {
  id: string;
  detail_json: StortingetHoring | null;
  last_synced_at: string | null;
};

export function hearingDbConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

export async function loadStortingetHearingsFromDb(): Promise<StortingetHoring[] | null> {
  if (!hearingDbConfigured()) return null;

  const supabase = getAnonSupabase();
  const { data, error } = await supabase
    .from('stortinget_hearings')
    .select('id, detail_json, last_synced_at')
    .order('innspillsfrist', { ascending: false, nullsFirst: false })
    .limit(500);

  if (error) {
    console.warn('stortinget_hearings read failed, falling back to live API', error.message);
    return null;
  }

  const rows = (data ?? []) as HearingDbRow[];
  if (rows.length === 0) return null;

  const hearings: StortingetHoring[] = [];
  for (const row of rows) {
    if (row.detail_json && typeof row.detail_json === 'object' && 'id' in row.detail_json) {
      hearings.push(row.detail_json);
      continue;
    }
    hearings.push({ id: row.id });
  }
  return hearings;
}

export async function loadStortingetHearingByIdFromDb(
  id: string,
): Promise<StortingetHoring | null> {
  if (!hearingDbConfigured()) return null;

  const supabase = getAnonSupabase();
  const { data, error } = await supabase
    .from('stortinget_hearings')
    .select('detail_json')
    .eq('id', id)
    .maybeSingle();

  if (error || !data?.detail_json) return null;
  const detail = data.detail_json as StortingetHoring;
  return detail?.id != null ? detail : { id };
}
