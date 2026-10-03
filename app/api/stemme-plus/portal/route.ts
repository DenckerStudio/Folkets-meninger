import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { createBillingPortalSession } from '@/lib/stripe/subscription';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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

  const customerId = data?.stripe_customer_id;
  if (!customerId || typeof customerId !== 'string') {
    return NextResponse.json(
      { error: 'Ingen Stripe-kunde er knyttet til kontoen. Admin-tildelt Stemme+ har ikke selvbetjent portal.' },
      { status: 409 },
    );
  }

  const origin = new URL(request.url).origin;
  const result = await createBillingPortalSession({ customerId, origin });
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ url: result.url });
}
