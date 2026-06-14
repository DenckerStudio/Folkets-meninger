import { getServiceSupabase } from '@/lib/supabase';
import { routes } from '@/lib/routes';

/** Minimum ballots before aggregate is published (k-anonymity). */
export const GOVERNMENT_STATS_MIN_VOTES = 50;

export type PublicVoteStatRow = {
  stortingetIssueId: string;
  title: string;
  status: string | null;
  for: number;
  against: number;
  abstain: number;
  total: number;
  sufficientData: boolean;
  stortingetUrl: string;
  sakPageUrl: string;
  updatedAt: string;
};

export type GovernmentStatsSnapshot = {
  generatedAt: string;
  minVotesThreshold: number;
  disclaimer: string;
  issues: PublicVoteStatRow[];
};

async function fetchVoteTotals(
  issueIds: string[],
): Promise<Record<string, { for: number; against: number; abstain: number; total: number }>> {
  const result: Record<string, { for: number; against: number; abstain: number; total: number }> = {};

  if (!issueIds.length || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return result;
  }

  const service = getServiceSupabase();
  const { data, error } = await service.rpc('get_vote_totals_batch', {
    p_issue_ids: issueIds,
  });

  if (error || !data || typeof data !== 'object') {
    return result;
  }

  const batch = data as Record<string, { for?: number; against?: number; abstain?: number; total?: number }>;
  for (const [issueId, counts] of Object.entries(batch)) {
    const forCount = counts.for ?? 0;
    const againstCount = counts.against ?? 0;
    const abstainCount = counts.abstain ?? 0;
    result[issueId] = {
      for: forCount,
      against: againstCount,
      abstain: abstainCount,
      total: counts.total ?? forCount + againstCount + abstainCount,
    };
  }
  return result;
}

export async function buildGovernmentStatsSnapshot(options?: {
  limit?: number;
  issueIds?: string[];
}): Promise<GovernmentStatsSnapshot> {
  const generatedAt = new Date().toISOString();
  const limit = options?.limit ?? 100;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      generatedAt,
      minVotesThreshold: GOVERNMENT_STATS_MIN_VOTES,
      disclaimer: PUBLIC_STATS_DISCLAIMER,
      issues: [],
    };
  }

  const service = getServiceSupabase();
  let issuesQuery = service
    .from('stortinget_issues')
    .select('id, title, status')
    .order('first_seen_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (options?.issueIds?.length) {
    issuesQuery = service
      .from('stortinget_issues')
      .select('id, title, status')
      .in('id', options.issueIds);
  }

  const { data: issues } = await issuesQuery;
  const rows = issues ?? [];
  const ids = rows.map((r) => r.id);
  const totals = await fetchVoteTotals(ids);

  const siteBase =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://folketsstemme.no';

  const publicRows: PublicVoteStatRow[] = rows
    .map((issue) => {
      const v = totals[issue.id] ?? { for: 0, against: 0, abstain: 0, total: 0 };
      const sufficient = v.total >= GOVERNMENT_STATS_MIN_VOTES;
      return {
        stortingetIssueId: issue.id,
        title: issue.title ?? `Sak ${issue.id}`,
        status: issue.status,
        for: sufficient ? v.for : 0,
        against: sufficient ? v.against : 0,
        abstain: sufficient ? v.abstain : 0,
        total: sufficient ? v.total : 0,
        sufficientData: sufficient,
        stortingetUrl: `https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/?id=${issue.id}`,
        sakPageUrl: `${siteBase}${routes.sak(issue.id)}`,
        updatedAt: generatedAt,
      };
    })
    .filter((r) => r.sufficientData)
    .sort((a, b) => b.total - a.total);

  return {
    generatedAt,
    minVotesThreshold: GOVERNMENT_STATS_MIN_VOTES,
    disclaimer: PUBLIC_STATS_DISCLAIMER,
    issues: publicRows,
  };
}

export const PUBLIC_STATS_DISCLAIMER =
  'Folkets Stemme er en uavhengig plattform. Tallene er anonyme aggregater over innloggede brukeres stemmer og inkluderer ikke persondata eller foruminnlegg. Saker med færre enn 50 stemmer vises ikke av personvernhensyn.';

export function snapshotToCsv(snapshot: GovernmentStatsSnapshot): string {
  const header = [
    'stortinget_issue_id',
    'title',
    'status',
    'for',
    'against',
    'abstain',
    'total',
    'stortinget_url',
    'sak_page_url',
    'generated_at',
  ].join(',');

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const lines = snapshot.issues.map((r) =>
    [
      r.stortingetIssueId,
      escape(r.title),
      r.status ?? '',
      r.for,
      r.against,
      r.abstain,
      r.total,
      escape(r.stortingetUrl),
      escape(r.sakPageUrl),
      snapshot.generatedAt,
    ].join(','),
  );

  return [header, ...lines].join('\n');
}
