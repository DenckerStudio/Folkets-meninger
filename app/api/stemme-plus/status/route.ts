import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { isStripeConfigured } from '@/lib/stripe/config';
import { getStripeClient } from '@/lib/stripe/client';
import { STEMME_PLUS_MONTHLY_PRICE_NOK } from '@/lib/stemme-plus/constants';
import { isStemmePlusActive } from '@/lib/stemme-plus/tier';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 });
  }

  const service = getServiceSupabase();
  const { data } = await service
    .from('users')
    .select(
      'subscription_tier, subscription_status, subscription_period_end, stripe_customer_id, stripe_subscription_id',
    )
    .eq('id', user.id)
    .maybeSingle();

  const row = data ?? {
    subscription_tier: 'free',
    subscription_status: null,
    subscription_period_end: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
  };

  return NextResponse.json({
    tier: isStemmePlusActive(row) ? 'stemme_plus' : 'free',
    subscription_status: row.subscription_status ?? null,
    subscription_period_end: row.subscription_period_end ?? null,
    has_stripe_customer: Boolean(row.stripe_customer_id),
    stripe_configured: isStripeConfigured(),
    monthly_price_nok: STEMME_PLUS_MONTHLY_PRICE_NOK,
  });
}
