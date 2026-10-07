import { NextResponse } from 'next/server';
import { getServerSupabase, getUser } from '@/lib/supabase-server';
import { isStripeCheckoutConfigured } from '@/lib/stripe/config';
import { createStemmePlusCheckoutSession } from '@/lib/stripe/subscription';
import { ownUserHasStemmePlus, readUserSubscription } from '@/lib/stemme-plus/service';

export const dynamic = 'force-dynamic';

export async function POST() {
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

  const alreadyPlus = await ownUserHasStemmePlus(user.id);
  if (alreadyPlus) {
    return NextResponse.json({ error: 'Du har allerede Stemme+' }, { status: 409 });
  }

  const result = await createStemmePlusCheckoutSession({
    userId: user.id,
    email: user.email ?? null,
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error, configured: false }, { status: result.status });
  }

  return NextResponse.json({ url: result.url, configured: true });
}

export async function GET() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  const row = await readUserSubscription(supabase, user.id);

  return NextResponse.json({
    configured: isStripeCheckoutConfigured(),
    hasCustomer: Boolean(row.stripe_customer_id),
  });
}
