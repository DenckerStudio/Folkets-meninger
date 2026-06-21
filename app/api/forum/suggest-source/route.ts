import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { getSourceSuggestionAccess } from '@/lib/forum/source-suggestion-access';
import { getUserPointsProfile } from '@/lib/user-points-profile';

export const dynamic = 'force-dynamic';

function mapSuggestError(message: string): { status: number; error: string } {
  const lower = message.toLowerCase();
  if (lower.includes('insufficient points')) {
    return {
      status: 403,
      error: 'Du trenger minst 5 000 poeng (Veteran) for å foreslå nye kilder.',
    };
  }
  if (lower.includes('monthly source suggestion limit')) {
    return {
      status: 429,
      error: 'Du har nådd månedlig grense for kildeforslag (3).',
    };
  }
  if (lower.includes('domain already exists')) {
    return { status: 409, error: 'Dette domenet finnes allerede i systemet.' };
  }
  if (lower.includes('invalid domain')) {
    return { status: 400, error: 'Ugyldig domene. Bruk f.eks. vg.no uten https://.' };
  }
  if (lower.includes('invalid outlet label')) {
    return { status: 400, error: 'Visningsnavn må være mellom 2 og 80 tegn.' };
  }
  return { status: 500, error: 'Kunne ikke sende kildeforslag' };
}

async function getMonthlySuggestionCount(userId: string): Promise<number> {
  const service = getServiceSupabase();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await service
    .from('forum_trusted_sources')
    .select('id', { count: 'exact', head: true })
    .eq('suggested_by', userId)
    .gte('created_at', since);

  return count ?? 0;
}

export async function GET() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  const [pointsProfile, monthlyUsed] = await Promise.all([
    getUserPointsProfile(user.id, 0),
    getMonthlySuggestionCount(user.id),
  ]);

  return NextResponse.json({
    access: getSourceSuggestionAccess(pointsProfile.points, monthlyUsed),
    points: pointsProfile.points,
    points_progress: pointsProfile.progress,
  });
}

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
    }

    await ensurePublicUser(user);

    const body = await request.json().catch(() => ({}));
    const domain = typeof body.domain === 'string' ? body.domain.trim() : '';
    const outletLabel = typeof body.outlet_label === 'string' ? body.outlet_label.trim() : '';

    const pointsProfile = await getUserPointsProfile(user.id, 0);
    const monthlyUsed = await getMonthlySuggestionCount(user.id);
    const access = getSourceSuggestionAccess(pointsProfile.points, monthlyUsed);

    if (!access.canSuggest && access.pointsNeeded > 0) {
      return NextResponse.json(
        { error: `Du trenger ${access.pointsNeeded} poeng til for å foreslå kilder.` },
        { status: 403 },
      );
    }

    if (!access.canSuggest) {
      return NextResponse.json(
        { error: 'Du har brukt opp månedlig kvote for kildeforslag.' },
        { status: 429 },
      );
    }

    const service = getServiceSupabase();
    const { data, error } = await service.rpc('suggest_trusted_news_source', {
      p_user_id: user.id,
      p_domain: domain,
      p_outlet_label: outletLabel,
    });

    if (error) {
      const mapped = mapSuggestError(error.message ?? '');
      return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }

    return NextResponse.json({
      success: true,
      source: data,
      message: 'Kildeforslag sendt til admin for vurdering.',
      access: getSourceSuggestionAccess(pointsProfile.points, monthlyUsed + 1),
    });
  } catch (error) {
    console.error('suggest-source error', error);
    return NextResponse.json({ error: 'En feil oppstod' }, { status: 500 });
  }
}
