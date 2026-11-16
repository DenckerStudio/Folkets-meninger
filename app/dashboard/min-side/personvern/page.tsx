import { MinSidePersonvernPage } from '@/components/min-side/min-side-section-pages';
import { getServerSupabase } from '@/lib/supabase-server';

export default async function MinSidePersonvernRoutePage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <MinSidePersonvernPage userId={user?.id ?? ''} />;
}