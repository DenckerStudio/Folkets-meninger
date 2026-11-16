import { MinSideStemmerPage } from '@/components/min-side/min-side-section-pages';
import { getServerSupabase } from '@/lib/supabase-server';

export default async function MinSideStemmerOgMeningerPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <MinSideStemmerPage userId={user?.id ?? ''} />;
}