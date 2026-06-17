import { getPolitikereOversikt, getSaker } from '@/lib/stortinget';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import PolitikerHubClient from './politiker-hub-client';

export const revalidate = 3600;

async function getPoliticianVerificationStatus(): Promise<boolean> {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const service = getServiceSupabase();
    const { data } = await service
      .from('politician_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    return !!data;
  } catch {
    return false;
  }
}

export default async function PolitikerHubPage() {
  const [initialIssues, initialPolitikere, isVerified] = await Promise.all([
    getSaker({ nextRevalidateSeconds: 3600 }),
    getPolitikereOversikt(),
    getPoliticianVerificationStatus(),
  ]);

  return (
    <PolitikerHubClient
      initialIssues={initialIssues}
      initialPolitikere={initialPolitikere}
      isVerified={isVerified}
    />
  );
}
