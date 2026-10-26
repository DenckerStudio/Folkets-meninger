import { Suspense } from 'react';
import { ProfileShell } from '@/components/profile/profile-shell';
import { isAdmin } from '@/lib/admin/gate';
import { isStripeCheckoutConfigured } from '@/lib/stripe/config';
import { getServerSupabase } from '@/lib/supabase-server';

export default async function MinSidePage() {
  const checkoutConfigured = isStripeCheckoutConfigured();
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerIsAdmin = user ? await isAdmin(user.id, user.email) : false;

  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Laster…</div>}>
      <ProfileShell
        stemmePlusCheckoutConfigured={checkoutConfigured}
        viewerIsAdmin={viewerIsAdmin}
      />
    </Suspense>
  );
}
