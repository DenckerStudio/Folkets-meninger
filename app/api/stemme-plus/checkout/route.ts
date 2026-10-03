import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { isStripeCheckoutConfigured } from '@/lib/stripe/config';
import { createStemmePlusCheckoutSession } from '@/lib/stripe/subscription';
import { userHasStemmePlus } from '@/lib/stemme-plus/service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  if (!isStripeCheckoutConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        error: 'Stripe-betaling er ikke konfigurert ennå. Admin kan tildele Stemme+ for testing.',
      },
      { status: 503 },
    );
  }

  const alreadyPlus = await userHasStemmePlus(user.id);
  if (alreadyPlus) {
    return NextResponse.json({ error: 'Du har allerede Stemme+' }, { status: 409 });
  }

  const origin = new URL(request.url).origin;
  const result = await createStemmePlusCheckoutSession({
    userId: user.id,
    email: user.email ?? null,
    origin,
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error, configured: false }, { status: result.status });
  }

  return NextResponse.json({ url: result.url, configured: true });
}

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  const service = getServiceSupabase();
  const { data } = await service
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.json({
    configured: isStripeCheckoutConfigured(),
    hasCustomer: Boolean(data?.stripe_customer_id),
  });
}
