import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { createBillingPortalSession } from '@/lib/stripe/subscription';
import { readUserSubscription } from '@/lib/stemme-plus/service';

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  const row = await readUserSubscription(supabase, user.id);
  const customerId = row.stripe_customer_id;
  if (!customerId || typeof customerId !== 'string') {
    return NextResponse.json(
      { error: 'Ingen Stripe-kunde er knyttet til kontoen. Admin-tildelt Stemme+ har ikke selvbetjent portal.' },
      { status: 409 },
    );
  }

  const result = await createBillingPortalSession({ customerId });
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ url: result.url });
}
