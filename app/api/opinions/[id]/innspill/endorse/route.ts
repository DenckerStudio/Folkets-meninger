import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  endorseOpinionInnspill,
  getOpinionInnspill,
} from '@/lib/innspill/service';

export const dynamic = 'force-dynamic';

/** POST /api/opinions/[id]/innspill/endorse — toggle support for an innspill. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opinionId } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  const rate = checkRateLimit(`opinion-innspill-endorse:${user.id}`, 30, 60_000);
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'For mange forsøk. Prøv igjen om litt.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
    );
  }

  const innspill = await getOpinionInnspill(opinionId);
  if (!innspill) {
    return NextResponse.json({ error: 'Innspill ikke funnet' }, { status: 404 });
  }
  if (innspill.status === 'withdrawn') {
    return NextResponse.json({ error: 'Innspillet er trukket tilbake' }, { status: 400 });
  }

  try {
    const result = await endorseOpinionInnspill(user.id, opinionId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('endorseOpinionInnspill error:', error);
    const message = error instanceof Error ? error.message : 'Kunne ikke registrere støtte';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
