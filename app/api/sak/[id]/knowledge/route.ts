import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getSakPageBundle } from '@/lib/stortinget';
import {
  buildQuizForIssue,
  recordDocumentRead,
  submitKnowledgeQuiz,
  userHasPassedQuiz,
} from '@/lib/knowledge/service';
import { getQuizContextLevel, toPublicQuizQuestions } from '@/lib/knowledge/quiz';
import { getAiSummaryFromDb } from '@/lib/ai-summary/service';

export const dynamic = 'force-dynamic';

function komiteName(detail: { komite?: { navn?: string } | string | null } | null): string | null {
  if (!detail?.komite) return null;
  return typeof detail.komite === 'object' ? detail.komite.navn ?? null : String(detail.komite);
}

async function quizSource(issueId: string) {
  const bundle = await getSakPageBundle(issueId);
  if (!bundle) return null;
  return {
    issueId: bundle.sak.id,
    title: bundle.sak.title,
    summary: bundle.sak.summary,
    category: bundle.sak.category,
    komite: komiteName(bundle.detail),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const source = await quizSource(id);
  if (!source) {
    return NextResponse.json({ error: 'Sak ikke funnet' }, { status: 404 });
  }

  const aiSummary = await getAiSummaryFromDb(source.issueId);
  const quiz = await buildQuizForIssue({ ...source, aiSummary });
  const contextLevel = getQuizContextLevel({ ...source, aiSummary });
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const passed = user ? await userHasPassedQuiz(user.id, source.issueId) : false;

  return NextResponse.json({
    issueId: source.issueId,
    questions: toPublicQuizQuestions(quiz),
    passScore: quiz.passScore,
    passed,
    loggedIn: Boolean(user),
    contextLevel,
    hasAiSummary: Boolean(aiSummary),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Tjenesten er ikke konfigurert' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === 'string' ? body.action : '';

  if (action === 'read_document') {
    const documentId = typeof body.documentId === 'string' ? body.documentId.trim() : '';
    if (!documentId) {
      return NextResponse.json({ error: 'Mangler dokument-ID' }, { status: 400 });
    }
    const result = await recordDocumentRead({
      userId: user.id,
      issueId: id,
      documentId,
    });
    return NextResponse.json({ success: true, ...result });
  }

  if (action === 'submit_quiz') {
    const source = await quizSource(id);
    if (!source) {
      return NextResponse.json({ error: 'Sak ikke funnet' }, { status: 404 });
    }
    const answers =
      body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers)
        ? (body.answers as Record<string, string>)
        : {};
    const result = await submitKnowledgeQuiz({
      userId: user.id,
      source,
      answers,
    });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'Ukjent handling' }, { status: 400 });
}
