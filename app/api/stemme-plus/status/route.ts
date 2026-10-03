import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { byokStorageReady, getByokMeta } from '@/lib/byok/service';
import { isStripeCheckoutConfigured } from '@/lib/stripe/config';
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

  const active = isStemmePlusActive(row);
  const byok = active ? await getByokMeta(user.id) : null;

  return NextResponse.json({
    tier: active ? 'stemme_plus' : 'free',
    subscription_status: row.subscription_status ?? null,
    subscription_period_end: row.subscription_period_end ?? null,
    monthly_price_nok: STEMME_PLUS_MONTHLY_PRICE_NOK,
    checkout_configured: isStripeCheckoutConfigured(),
    has_stripe_customer: Boolean(row.stripe_customer_id),
    byok_encryption_ready: byokStorageReady(),
    has_byok: Boolean(byok),
    byok: byok
      ? {
          provider: byok.provider,
          model: byok.model,
          key_last4: byok.keyLast4,
        }
      : null,
  });
}
