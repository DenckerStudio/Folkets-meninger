import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { isStripeConfigured } from '@/lib/stripe/config';
import { getStripeClient } from '@/lib/stripe/client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Betaling er ikke koblet ennå', code: 'stripe_not_configured' },
      { status: 503 },
    );
  }

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 });
  }

  const service = getServiceSupabase();
  const { data: profile } = await service
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: 'Ingen aktiv Stripe-kunde — abonner først' },
      { status: 400 },
    );
  }

  const origin = new URL(request.url).origin;
  const stripe = getStripeClient();
  const portal = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${origin}/dashboard/min-side?tab=stemme-plus`,
  });

  return NextResponse.json({ url: portal.url });
}
