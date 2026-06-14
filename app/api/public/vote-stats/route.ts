import { NextResponse } from 'next/server';
import {
  buildGovernmentStatsSnapshot,
  GOVERNMENT_STATS_MIN_VOTES,
} from '@/lib/government-stats/snapshot';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const issueId = searchParams.get('issue_id');
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50));

  const snapshot = await buildGovernmentStatsSnapshot({
    limit: issueId ? undefined : limit,
    issueIds: issueId ? [issueId] : undefined,
  });

  if (issueId) {
    const row = snapshot.issues.find((i) => i.stortingetIssueId === issueId);
    if (!row) {
      return NextResponse.json({
        stortinget_issue_id: issueId,
        sufficient_data: false,
        min_votes_threshold: GOVERNMENT_STATS_MIN_VOTES,
        message: 'Utilstrekkelig datagrunnlag',
        disclaimer: snapshot.disclaimer,
        generated_at: snapshot.generatedAt,
      });
    }
    return NextResponse.json({
      ...row,
      disclaimer: snapshot.disclaimer,
      generated_at: snapshot.generatedAt,
    });
  }

  return NextResponse.json(snapshot);
}
