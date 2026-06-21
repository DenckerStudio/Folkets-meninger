import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { validatePromptSourceHeadlines } from '@/lib/forum/admin-prompt-validation';
import { getReelSubmissionAccess } from '@/lib/forum/reel-submission-access';
import { getUserPointsProfile } from '@/lib/user-points-profile';

export const dynamic = 'force-dynamic';

function mapSubmitError(message: string): { status: number; error: string } {
  const lower = message.toLowerCase();
  if (lower.includes('insufficient points')) {
    return {
      status: 403,
      error: 'Du trenger minst 750 poeng (Pålitelig) for å foreslå en reel.',
    };
  }
  if (lower.includes('weekly reel submission limit')) {
    return {
      status: 429,
      error: 'Du har nådd ukentlig grense for reel-innsending. Prøv igjen neste uke.',
    };
  }
  if (lower.includes('question too short')) {
    return { status: 400, error: 'Spørsmålet må være minst 12 tegn.' };
  }
  if (lower.includes('question too long')) {
    return { status: 400, error: 'Spørsmålet kan være maks 280 tegn.' };
  }
  if (lower.includes('sources required')) {
    return { status: 400, error: 'Legg inn minst én kilde med tittel og URL.' };
  }
  return { status: 500, error: 'Kunne ikke sende inn reel-forslag' };
}

async function getWeeklySubmissionCount(userId: string): Promise<number> {
  const service = getServiceSupabase();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await service
    .from('forum_prompts')
    .select('id', { count: 'exact', head: true })
    .eq('submitted_by', userId)
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

  const [pointsProfile, weeklyUsed] = await Promise.all([
    getUserPointsProfile(user.id, 0),
    getWeeklySubmissionCount(user.id),
  ]);

  const access = getReelSubmissionAccess(pointsProfile.points, weeklyUsed);

  return NextResponse.json({
    access,
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
    const question = typeof body.question === 'string' ? body.question.trim() : '';
    if (question.length < 12) {
      return NextResponse.json({ error: 'Spørsmålet må være minst 12 tegn' }, { status: 400 });
    }

    const sourcesCheck = validatePromptSourceHeadlines(body.source_headlines);
    if (!sourcesCheck.ok) {
      return NextResponse.json({ error: sourcesCheck.error }, { status: 400 });
    }

    const topicTags = Array.isArray(body.topic_tags)
      ? body.topic_tags.map((tag: unknown) => String(tag).trim()).filter(Boolean).slice(0, 8)
      : [];

    const sensitivity = body.sensitivity === 'high' ? 'high' : 'low';

    const pointsProfile = await getUserPointsProfile(user.id, 0);
    const weeklyUsed = await getWeeklySubmissionCount(user.id);
    const access = getReelSubmissionAccess(pointsProfile.points, weeklyUsed);

    if (!access.canSubmit && access.mode === 'locked') {
      return NextResponse.json(
        { error: `Du trenger ${access.pointsNeeded} poeng til for å foreslå reels.` },
        { status: 403 },
      );
    }

    if (!access.canSubmit) {
      return NextResponse.json(
        { error: 'Du har brukt opp ukentlig kvote for reel-innsending.' },
        { status: 429 },
      );
    }

    const service = getServiceSupabase();
    const { data, error } = await service.rpc('submit_forum_prompt', {
      p_user_id: user.id,
      p_question: question,
      p_source_headlines: sourcesCheck.sources,
      p_topic_tags: topicTags,
      p_sensitivity: sensitivity,
    });

    if (error) {
      const mapped = mapSubmitError(error.message ?? '');
      return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }

    const result = data as {
      id?: string;
      status?: string;
      requires_admin?: boolean;
      submission_tier?: string;
    };

    const updatedPoints = await getUserPointsProfile(user.id, 0);

    return NextResponse.json({
      success: true,
      id: result.id,
      status: result.status,
      requires_admin: result.requires_admin === true,
      submission_tier: result.submission_tier,
      message:
        result.status === 'active'
          ? 'Reelen er publisert og synlig for alle.'
          : 'Forslaget er sendt til admin for godkjenning.',
      points: updatedPoints.points,
      points_progress: updatedPoints.progress,
    });
  } catch (error) {
    console.error('reel-submit error', error);
    return NextResponse.json({ error: 'En feil oppstod' }, { status: 500 });
  }
}
