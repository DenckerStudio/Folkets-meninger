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

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Per-sak stemming (For/Mot/Avstår) er avviklet. Marker holdning (enig/uenig/ikke interessert) via /api/stance. Ja/nei-avstemninger finnes under Avstemninger.',
    },
    { status: 410 },
  );
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
