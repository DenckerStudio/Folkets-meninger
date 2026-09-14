import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { isIssueStance } from '@/lib/stances/types';
import { getUserStanceOnIssue, setIssueStance, StanceServiceError } from '@/lib/stances/service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { issueId, stance, title, summary } = await request.json();

    if (!issueId || !stance) {
      return NextResponse.json({ error: 'Mangler saks-ID eller holdning' }, { status: 400 });
    }

    if (!isIssueStance(stance)) {
      return NextResponse.json({ error: 'Ugyldig holdning' }, { status: 400 });
    }

    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Du må være logget inn for å lagre holdning' }, { status: 401 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Holdninger er ikke konfigurert på serveren (mangler service role key).' },
        { status: 503 },
      );
    }

    const service = getServiceSupabase();
    const savedStance = await setIssueStance(
      service,
      user.id,
      String(issueId),
      stance,
      title ?? null,
      summary ?? null,
    );

    return NextResponse.json({
      success: true,
      stance: savedStance,
    });
  } catch (error) {
    if (error instanceof StanceServiceError) {
      console.error('Stance RPC error:', error.message);
      return NextResponse.json({ error: 'Kunne ikke lagre holdning' }, { status: 500 });
    }

    console.error('Stance error:', error);
    return NextResponse.json({ error: 'Kunne ikke lagre holdning' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const issueId = url.searchParams.get('issueId');

  if (!issueId) {
    return NextResponse.json({ error: 'Mangler saks-ID' }, { status: 400 });
  }

  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ hasStance: false, stance: null });
    }

    const service = getServiceSupabase();
    const stance = await getUserStanceOnIssue(service, user.id, issueId);

    return NextResponse.json({
      hasStance: stance !== null,
      stance,
    });
  } catch (error) {
    console.error('Error fetching stance:', error);
    return NextResponse.json({ hasStance: false, stance: null });
  }
}
