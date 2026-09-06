import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { getStripeEnvConfig, isStripeConfigured } from '@/lib/stripe/config';
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

  if (!user?.email) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const service = getServiceSupabase();
  const { data: profile } = await service
    .from('users')
    .select('stripe_customer_id, first_name, last_name, name')
    .eq('id', user.id)
    .maybeSingle();

  const stripe = getStripeClient();
  const { stemmePlusPriceId } = getStripeEnvConfig();

  let customerId = profile?.stripe_customer_id ?? null;
  if (!customerId) {
    const displayName =
      profile?.first_name && profile?.last_name
        ? `${profile.first_name} ${profile.last_name}`
        : profile?.name || undefined;

    const customer = await stripe.customers.create({
      email: user.email,
      name: displayName,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    await service.from('users').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: stemmePlusPriceId, quantity: 1 }],
    success_url: `${origin}/dashboard/min-side?tab=stemme-plus&checkout=success`,
    cancel_url: `${origin}/dashboard/min-side?tab=stemme-plus&checkout=cancel`,
    client_reference_id: user.id,
    metadata: { supabase_user_id: user.id },
    subscription_data: {
      metadata: { supabase_user_id: user.id },
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: 'Kunne ikke starte betaling' }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
