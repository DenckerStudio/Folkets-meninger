import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const MAX_RESPONSE_LENGTH = 4000;

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Ikke logget inn' }, { status: 401 });
    }

    const body = await request.json();
    const stortingetIssueId =
      typeof body.stortinget_issue_id === 'string' ? body.stortinget_issue_id.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';

    if (!stortingetIssueId || !content) {
      return NextResponse.json({ error: 'Mangler påkrevde felt' }, { status: 400 });
    }

    if (content.length > MAX_RESPONSE_LENGTH) {
      return NextResponse.json(
        { error: `Svaret kan ikke være lengre enn ${MAX_RESPONSE_LENGTH} tegn` },
        { status: 400 },
      );
    }

    const service = getServiceSupabase();
    const { data: profile } = await service
      .from('politician_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Ikke verifisert politiker' }, { status: 403 });
    }

    const { data: existing } = await service
      .from('politician_responses')
      .select('id')
      .eq('politician_profile_id', profile.id)
      .eq('stortinget_issue_id', stortingetIssueId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Du har allerede publisert et offisielt svar på denne saken' },
        { status: 409 },
      );
    }

    const { error } = await service.from('politician_responses').insert({
      stortinget_issue_id: stortingetIssueId,
      politician_profile_id: profile.id,
      content,
    });

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Du har allerede publisert et offisielt svar på denne saken' },
          { status: 409 },
        );
      }
      console.error('Politician response error:', error);
      return NextResponse.json({ error: 'Kunne ikke publisere svar' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Politician response error:', error);
    return NextResponse.json({ error: 'En feil oppstod' }, { status: 500 });
  }
}
