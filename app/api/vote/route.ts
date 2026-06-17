import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { resolveSakTreatmentStatus } from '@/lib/sak-status';

export const dynamic = 'force-dynamic';

type VoteChoice = 'for' | 'against' | 'abstain';

async function getIssueVotingState(issueId: string) {
  const service = getServiceSupabase();
  const { data: issue } = await service
    .from('stortinget_issues')
    .select('status, ferdigbehandlet, voting_closes_at')
    .eq('id', issueId)
    .maybeSingle();

  const treatmentStatus =
    typeof issue?.ferdigbehandlet === 'boolean'
      ? resolveSakTreatmentStatus({ ferdigbehandlet: issue.ferdigbehandlet })
      : issue?.status === 'closed' || issue?.status === 'pending'
        ? issue.status
        : 'pending';

  const pastDeadline =
    issue?.voting_closes_at != null && new Date(issue.voting_closes_at).getTime() <= Date.now();

  let votingDaysLeft = 0;
  if (!pastDeadline && issue?.voting_closes_at && treatmentStatus !== 'closed') {
    votingDaysLeft = Math.max(
      1,
      Math.ceil((new Date(issue.voting_closes_at).getTime() - Date.now()) / 86_400_000),
    );
  }

  const votingClosed = treatmentStatus === 'closed' || pastDeadline;

  return {
    votingClosed,
    votingDaysLeft: votingClosed ? 0 : votingDaysLeft,
  };
}

function parseTotals(data: unknown) {
  if (!data || typeof data !== 'object') {
    return { for: 0, against: 0, abstain: 0, total: 0 };
  }
  const t = data as Record<string, number>;
  const forCount = t.for ?? 0;
  const againstCount = t.against ?? 0;
  const abstainCount = t.abstain ?? 0;
  return {
    for: forCount,
    against: againstCount,
    abstain: abstainCount,
    total: t.total ?? forCount + againstCount + abstainCount,
  };
}

export async function POST(request: Request) {
  try {
    const { issueId, vote, title, summary } = await request.json();

    if (!issueId || !vote) {
      return NextResponse.json({ error: 'Mangler saks-ID eller stemme' }, { status: 400 });
    }

    if (!['for', 'against', 'abstain'].includes(vote)) {
      return NextResponse.json({ error: 'Ugyldig stemmetype' }, { status: 400 });
    }

    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Du må være logget inn for å stemme' }, { status: 401 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Vote error: SUPABASE_SERVICE_ROLE_KEY is not configured');
      return NextResponse.json(
        { error: 'Stemming er ikke konfigurert på serveren (mangler service role key).' },
        { status: 503 }
      );
    }

    const service = getServiceSupabase();
    const votingState = await getIssueVotingState(String(issueId));
    if (votingState.votingClosed) {
      return NextResponse.json(
        { error: 'Stemming er stengt for denne saken' },
        { status: 403 },
      );
    }

    const { data, error } = await service.rpc('cast_vote', {
      p_user_id: user.id,
      p_issue_id: String(issueId),
      p_choice: vote as VoteChoice,
      p_title: title ?? null,
      p_summary: summary ?? null,
    });

    if (error) {
      const msg = error.message ?? '';
      const details = error.details ?? '';
      const combined = `${msg} ${details}`.toLowerCase();

      if (combined.includes('already voted')) {
        return NextResponse.json({ error: 'Du har allerede stemt på denne saken' }, { status: 409 });
      }
      if (combined.includes('voting closed')) {
        return NextResponse.json({ error: 'Stemming er stengt for denne saken' }, { status: 403 });
      }
      if (combined.includes('identity not verified')) {
        return NextResponse.json({ error: 'Din identitet er ikke verifisert ennå' }, { status: 403 });
      }
      if (combined.includes('not unique') || combined.includes('could not choose')) {
        return NextResponse.json(
          {
            error: 'Databasefeil: flere cast_vote-funksjoner. Kjør supabase/migrations/20260528000002_vote_schema_repair.sql.',
          },
          { status: 500 }
        );
      }
      if (combined.includes('does not exist') && combined.includes('cast_vote')) {
        return NextResponse.json(
          {
            error: 'Stemme-API er ikke satt opp i databasen. Kjør Supabase-migrasjonene.',
          },
          { status: 503 }
        );
      }

      console.error('Vote RPC error:', { message: error.message, details: error.details, hint: error.hint, code: error.code });
      return NextResponse.json(
        {
          error: 'Kunne ikke registrere stemme',
          code: error.code,
          hint: process.env.NODE_ENV === 'development' ? error.hint ?? error.message : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Stemme registrert anonymt',
      totals: parseTotals(data),
      userVote: vote,
    });
  } catch (error) {
    console.error('Voting Error:', error);
    return NextResponse.json({ error: 'Kunne ikke registrere stemme' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const issueId = url.searchParams.get('issueId');

  if (!issueId) {
    return NextResponse.json({ error: 'Mangler saks-ID' }, { status: 400 });
  }

  try {
    const service = getServiceSupabase();
    const { data: totalsData, error: totalsError } = await service.rpc('get_issue_vote_totals', {
      p_issue_id: issueId,
    });

    const totals = totalsError ? { for: 0, against: 0, abstain: 0, total: 0 } : parseTotals(totalsData);

    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    let userVote: VoteChoice | null = null;
    let hasVoted = false;

    if (user) {
      const { data: userData } = await service.rpc('get_user_vote_on_issue', {
        p_user_id: user.id,
        p_issue_id: issueId,
      });
      if (userData && typeof userData === 'object') {
        const u = userData as { hasVoted?: boolean; vote?: VoteChoice };
        hasVoted = Boolean(u.hasVoted);
        if (u.vote && ['for', 'against', 'abstain'].includes(u.vote)) {
          userVote = u.vote;
        }
      }
    }

    const votingState = await getIssueVotingState(issueId);

    return NextResponse.json({
      ...totals,
      hasVoted,
      userVote,
      votingClosed: votingState.votingClosed,
      votingDaysLeft: votingState.votingDaysLeft,
    });
  } catch (error) {
    console.error('Error fetching vote totals:', error);
    return NextResponse.json({ for: 0, against: 0, abstain: 0, total: 0, hasVoted: false, userVote: null });
  }
}
