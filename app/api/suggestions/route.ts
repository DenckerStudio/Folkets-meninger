import { NextResponse } from 'next/server';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { checkRateLimit } from '@/lib/rate-limit';
import { getServiceSupabase } from '@/lib/supabase';
import { getServerSupabase } from '@/lib/supabase-server';
import { validateSuggestionInput } from '@/lib/appens-fremtid/validate';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
    }

    const rate = checkRateLimit(`suggestions:${user.id}`, 5, 60_000);
    if (!rate.ok) {
      return NextResponse.json(
        { error: 'For mange forespørsler. Prøv igjen om litt.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rate.retryAfterSeconds) },
        },
      );
    }

    let payload: Record<string, unknown>;
    try {
      payload = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
    }

    const parsed = validateSuggestionInput(payload);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Forslag er midlertidig utilgjengelig.' },
        { status: 503 },
      );
    }

    await ensurePublicUser(user);

    const service = getServiceSupabase();
    const { data, error } = await service.rpc('create_app_suggestion', {
      p_user_id: user.id,
      p_title: parsed.title,
      p_body: parsed.body,
      p_category: parsed.category,
      p_audience: parsed.audience,
    });

    if (error) {
      console.error('[suggestions] insert failed', error.message);
      return NextResponse.json({ error: 'Kunne ikke sende forslaget.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data });
  } catch (error) {
    console.error('[suggestions] unexpected error', error);
    return NextResponse.json({ error: 'En feil oppstod' }, { status: 500 });
  }
}
