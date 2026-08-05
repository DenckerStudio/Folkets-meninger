import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  castPollVote,
  getPollById,
  getPollTopArguments,
  getPollTotals,
  getPollTotalsByFylke,
  getUserPollVote,
  isPollVotingOpen,
  listOpenPolls,
} from '@/lib/polls/service';
import type { PollChoice } from '@/lib/polls/types';

export const dynamic = 'force-dynamic';

function isPollChoice(value: unknown): value is PollChoice {
  return value === 'ja' || value === 'nei' || value === 'blank';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pollId = url.searchParams.get('pollId');

  if (!pollId) {
    const polls = await listOpenPolls(40);
    return NextResponse.json({ polls });
  }

  const poll = await getPollById(pollId);
  if (!poll) {
    return NextResponse.json({ error: 'Avstemning ikke funnet' }, { status: 404 });
  }

  const [totals, byFylke, argumentsBySide] = await Promise.all([
    getPollTotals(pollId),
    getPollTotalsByFylke(pollId),
    getPollTopArguments(pollId, 2),
  ]);

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasVoted = false;
  let userVote: PollChoice | null = null;
  if (user) {
    const voteState = await getUserPollVote(user.id, pollId);
    hasVoted = voteState.hasVoted;
    userVote = voteState.vote;
  }

  return NextResponse.json({
    poll,
    totals,
    byFylke,
    arguments: argumentsBySide,
    hasVoted,
    userVote,
    votingOpen: isPollVotingOpen(poll),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pollId = typeof body.pollId === 'string' ? body.pollId : null;
    const choice = body.choice;

    if (!pollId || !isPollChoice(choice)) {
      return NextResponse.json({ error: 'Mangler avstemnings-ID eller ugyldig stemme' }, { status: 400 });
    }

    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Du må være logget inn for å stemme' }, { status: 401 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Stemming er ikke konfigurert på serveren' }, { status: 503 });
    }

    const poll = await getPollById(pollId);
    if (!poll) {
      return NextResponse.json({ error: 'Avstemning ikke funnet' }, { status: 404 });
    }
    if (!isPollVotingOpen(poll)) {
      return NextResponse.json({ error: 'Stemming er stengt for denne avstemningen' }, { status: 403 });
    }

    const totals = await castPollVote({ userId: user.id, pollId, choice });
    return NextResponse.json({
      success: true,
      message: 'Stemme registrert anonymt',
      totals,
      userVote: choice,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const combined = message.toLowerCase();
    if (combined.includes('already voted')) {
      return NextResponse.json({ error: 'Du har allerede stemt' }, { status: 409 });
    }
    if (combined.includes('voting closed') || combined.includes('not open')) {
      return NextResponse.json({ error: 'Stemming er stengt for denne avstemningen' }, { status: 403 });
    }
    console.error('Poll vote error:', error);
    return NextResponse.json({ error: 'Kunne ikke registrere stemme' }, { status: 500 });
  }
}
