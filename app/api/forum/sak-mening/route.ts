import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { validateSakMeningStatement } from '@/lib/forum/sak-mening';

export const dynamic = 'force-dynamic';

function mapSubmitError(message: string): { status: number; error: string } {
  const lower = message.toLowerCase();
  if (lower.includes('forum identity required')) {
    return {
      status: 403,
      error: 'Du må fylle ut fornavn og etternavn på profilen din før du kan dele en mening.',
    };
  }
  if (lower.includes('weekly sak mening limit')) {
    return {
      status: 429,
      error: 'Du har nådd ukentlig grense for ja/nei-meninger. Prøv igjen neste uke.',
    };
  }
  if (lower.includes('question too short')) {
    return { status: 400, error: 'Meningen er for kort.' };
  }
  if (lower.includes('question too long')) {
    return { status: 400, error: 'Meningen er for lang (maks 280 tegn).' };
  }
  if (lower.includes('question must start')) {
    return { status: 400, error: 'Alle ja/nei-meninger må starte med «(Jeg mener)».' };
  }
  if (lower.includes('issue not found')) {
    return { status: 404, error: 'Saken finnes ikke.' };
  }
  return { status: 500, error: 'Kunne ikke opprette ja/nei-mening' };
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
    const issueId = typeof body.stortinget_issue_id === 'string' ? body.stortinget_issue_id.trim() : '';
    if (!issueId) {
      return NextResponse.json({ error: 'Mangler sak' }, { status: 400 });
    }

    const statement = typeof body.statement === 'string' ? body.statement.trim() : '';
    const validated = validateSakMeningStatement(statement);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const service = getServiceSupabase();
    const { data, error } = await service.rpc('submit_sak_mening_prompt', {
      p_user_id: user.id,
      p_stortinget_issue_id: issueId,
      p_question: validated.question,
    });

    if (error) {
      const mapped = mapSubmitError(error.message ?? '');
      return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }

    const result = data as { id?: string; status?: string };
    return NextResponse.json({
      success: true,
      id: result.id,
      status: result.status,
      message: 'Ja/nei-meningen er publisert i forumet.',
    });
  } catch (error) {
    console.error('sak-mening submit error', error);
    return NextResponse.json({ error: 'En feil oppstod' }, { status: 500 });
  }
}
