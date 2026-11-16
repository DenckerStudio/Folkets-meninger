import { MinSideStemmePlusPage } from '@/components/min-side/min-side-section-pages';
import { isAdmin } from '@/lib/admin/gate';
import { isStripeCheckoutConfigured } from '@/lib/stripe/config';
import { getServerSupabase } from '@/lib/supabase-server';

export default async function MinSideStemmePlusRoutePage() {
  const checkoutConfigured = isStripeCheckoutConfigured();
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerIsAdmin = user ? await isAdmin(user.id, user.email) : false;

  return (
    <MinSideStemmePlusPage checkoutConfigured={checkoutConfigured} isAdmin={viewerIsAdmin} />
  );
}