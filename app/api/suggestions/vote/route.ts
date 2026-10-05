import { NextResponse } from 'next/server';
import { castAppSuggestionVote } from '@/lib/admin/suggestions';
import { isSuggestionVote } from '@/lib/appens-fremtid/constants';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Stemming er midlertidig utilgjengelig.' }, { status: 503 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  const id = typeof payload.id === 'string' ? payload.id.trim() : '';
  if (!id || !isSuggestionVote(payload.vote)) {
    return NextResponse.json({ error: 'Mangler forslag eller stemme' }, { status: 400 });
  }

  try {
    const result = await castAppSuggestionVote(user.id, id, payload.vote);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.toLowerCase().includes('closed')) {
      return NextResponse.json({ error: 'Dette forslaget er ikke åpent for stemming.' }, { status: 409 });
    }
    if (message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: 'Forslaget ble ikke funnet' }, { status: 404 });
    }
    console.error('[suggestions/vote] failed', error);
    return NextResponse.json({ error: 'Kunne ikke registrere stemmen.' }, { status: 500 });
  }
}
