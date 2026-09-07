import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
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
    .select('subscription_tier, subscription_status, subscription_period_end')
    .eq('id', user.id)
    .maybeSingle();

  const row = data ?? {
    subscription_tier: 'free',
    subscription_status: null,
    subscription_period_end: null,
  };

  return NextResponse.json({
    tier: isStemmePlusActive(row) ? 'stemme_plus' : 'free',
    subscription_status: row.subscription_status ?? null,
    subscription_period_end: row.subscription_period_end ?? null,
    monthly_price_nok: STEMME_PLUS_MONTHLY_PRICE_NOK,
  });
}
