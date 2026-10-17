import {
  EMPTY_POLITICAL_CONSENT_STATE,
  type PoliticalConsentPurpose,
  type PoliticalConsentState,
  POLITICAL_CONSENT_TEXT_VERSION,
} from '@/lib/consent/political-consent';
import type { SupabaseClient } from '@supabase/supabase-js';

type ConsentRow = {
  purpose: string;
  consent_text_version: string;
  withdrawn_at: string | null;
};

const PURPOSE_TO_KEY: Record<PoliticalConsentPurpose, keyof Omit<PoliticalConsentState, 'textVersion'>> = {
  political_storage: 'storage',
  political_profiling: 'profiling',
  political_byok_activity: 'byokActivity',
};

export async function loadPoliticalConsentState(
  service: SupabaseClient,
  userId: string,
): Promise<PoliticalConsentState> {
  const { data, error } = await service
    .from('user_political_consents')
    .select('purpose, consent_text_version, withdrawn_at')
    .eq('user_id', userId);

  if (error || !data) {
    return { ...EMPTY_POLITICAL_CONSENT_STATE };
  }

  const state: PoliticalConsentState = { ...EMPTY_POLITICAL_CONSENT_STATE };
  for (const row of data as ConsentRow[]) {
    if (row.withdrawn_at) continue;
    const key = PURPOSE_TO_KEY[row.purpose as PoliticalConsentPurpose];
    if (key) {
      state[key] = true;
      state.textVersion = row.consent_text_version || POLITICAL_CONSENT_TEXT_VERSION;
    }
  }
  return state;
}

export async function userHasPoliticalConsent(
  service: SupabaseClient,
  userId: string,
  purpose: PoliticalConsentPurpose,
): Promise<boolean> {
  const { data, error } = await service.rpc('user_has_political_consent', {
    p_user_id: userId,
    p_purpose: purpose,
  });
  if (error) {
    console.error('user_has_political_consent error:', error.message);
    return false;
  }
  return data === true;
}

export async function recordPoliticalConsents(
  service: SupabaseClient,
  userId: string,
  input: Pick<PoliticalConsentState, 'storage' | 'profiling' | 'byokActivity'>,
): Promise<void> {
  const entries: Array<{ purpose: PoliticalConsentPurpose; active: boolean }> = [
    { purpose: 'political_storage', active: input.storage },
    { purpose: 'political_profiling', active: input.profiling },
    { purpose: 'political_byok_activity', active: input.byokActivity },
  ];

  for (const entry of entries) {
    if (entry.active) {
      const { error } = await service.rpc('record_political_consent', {
        p_user_id: userId,
        p_purpose: entry.purpose,
        p_consent_text_version: POLITICAL_CONSENT_TEXT_VERSION,
      });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await service.rpc('withdraw_political_consent', {
        p_user_id: userId,
        p_purpose: entry.purpose,
      });
      if (error) throw new Error(error.message);
    }
  }
}

export async function withdrawAllPoliticalConsents(service: SupabaseClient, userId: string): Promise<void> {
  const { error } = await service.rpc('withdraw_all_political_consents', { p_user_id: userId });
  if (error) throw new Error(error.message);
}
