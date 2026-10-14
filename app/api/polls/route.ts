import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  castPollVote,
  getPollById,
  getPollTotals,
  getPollTotalsByFylke,
  getUserPollVote,
  isPollVotingOpen,
  listOpenPolls,
} from '@/lib/polls/service';
import { issueStanceFromPollChoice } from '@/lib/stances/model';
import { setIssueStance } from '@/lib/stances/service';
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
  if (!poll || poll.track === 'citizen') {
    return NextResponse.json({ error: 'Avstemning ikke funnet' }, { status: 404 });
  }

  const [totals, byFylke] = await Promise.all([getPollTotals(pollId), getPollTotalsByFylke(pollId)]);

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
    if (!poll || poll.track === 'citizen') {
      return NextResponse.json({ error: 'Avstemning ikke funnet' }, { status: 404 });
    }
    if (!isPollVotingOpen(poll)) {
      return NextResponse.json({ error: 'Stemming er stengt for denne avstemningen' }, { status: 403 });
    }

    const totals = await castPollVote({ userId: user.id, pollId, choice });

    // A Ja/Nei vote on a Stortinget-backed poll is the same signal as an issue
    // stance, so keep the stance history in sync (B2). A blank vote ("Stem
    // blankt") is an abstention, not the deliberate "ikke interessert" stance,
    // so it must not overwrite the user's stance history. Best-effort: the vote
    // is already recorded and must not fail if this write does.
    if (poll.stortingetIssueId) {
      const issueStance = issueStanceFromPollChoice(choice);
      if (issueStance) {
        try {
          await setIssueStance(
            getServiceSupabase(),
            user.id,
            poll.stortingetIssueId,
            issueStance,
            poll.title,
            poll.neutralSummary,
          );
        } catch (stanceError) {
          console.error('Poll stance sync error:', stanceError);
        }
      }
    }

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
