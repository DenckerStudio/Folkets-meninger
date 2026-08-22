import { isAdmin } from '@/lib/admin/gate';
import {
  counterProposalCreatedAward,
  counterProposalEndorsedAward,
} from '@/lib/knowledge/award';
import { syncUserBadges } from '@/lib/knowledge/service';
import { getServiceSupabase } from '@/lib/supabase';
import {
  fetchStortingetHoringer,
  findHoringerForSak,
  formatHoringDeadlineSummary,
  getHoringInnspillDeadline,
  getHoringTitle,
  isHoringOpen,
} from '@/lib/stortinget-horinger';
import { triggerHearingInnspillWebhook } from '@/lib/trigger-hearing-innspill-webhook';
import {
  buildCounterProposalPackage,
  canPackageCounterProposal,
  counterProposalPackageToMarkdown,
} from './package';
import {
  COUNTER_PROPOSAL_BODY_MIN,
  COUNTER_PROPOSAL_DEFAULT_THRESHOLD,
  COUNTER_PROPOSAL_TITLE_MIN,
  type CounterProposalHearingLink,
  type CounterProposalRecord,
  type CounterProposalStatus,
} from './types';

type CounterProposalRow = {
  id: string;
  stortinget_issue_id: string;
  author_user_id: string;
  title: string;
  body: string;
  status: CounterProposalStatus;
  support_threshold: number;
  support_count: number;
  stortinget_hearing_id: string | null;
  hearing_deadline_at: string | null;
  packaged_at: string | null;
  created_at: string;
};

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function mapRow(
  row: CounterProposalRow,
  authorName: string | null = null,
): CounterProposalRecord {
  return {
    id: row.id,
    stortingetIssueId: row.stortinget_issue_id,
    authorUserId: row.author_user_id,
    authorName,
    title: row.title,
    body: row.body,
    status: row.status,
    supportThreshold: row.support_threshold,
    supportCount: row.support_count,
    stortingetHearingId: row.stortinget_hearing_id,
    hearingDeadlineAt: row.hearing_deadline_at,
    packagedAt: row.packaged_at,
    createdAt: row.created_at,
  };
}

async function authorNamesById(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const names = new Map<string, string>();
  if (unique.length === 0 || !supabaseConfigured()) return names;

  const service = getServiceSupabase();
  const { data } = await service
    .from('users')
    .select('id, first_name, last_name, name')
    .in('id', unique);

  for (const user of data ?? []) {
    const full =
      user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`.trim()
        : user.name;
    if (full) names.set(user.id, full);
  }
  return names;
}

export async function listCounterProposals(issueId: string): Promise<CounterProposalRecord[]> {
  if (!supabaseConfigured()) return [];
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('counter_proposals')
    .select(
      'id, stortinget_issue_id, author_user_id, title, body, status, support_threshold, support_count, stortinget_hearing_id, hearing_deadline_at, packaged_at, created_at',
    )
    .eq('stortinget_issue_id', issueId)
    .in('status', ['gathering', 'threshold_met', 'packaged'])
    .order('support_count', { ascending: false })
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  const names = await authorNamesById(data.map((row) => row.author_user_id));
  return data.map((row) => mapRow(row as CounterProposalRow, names.get(row.author_user_id) ?? null));
}

export async function getCounterProposal(id: string): Promise<CounterProposalRecord | null> {
  if (!supabaseConfigured()) return null;
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('counter_proposals')
    .select(
      'id, stortinget_issue_id, author_user_id, title, body, status, support_threshold, support_count, stortinget_hearing_id, hearing_deadline_at, packaged_at, created_at',
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  const names = await authorNamesById([data.author_user_id]);
  return mapRow(data as CounterProposalRow, names.get(data.author_user_id) ?? null);
}

export async function userEndorsedCounterProposalIds(
  userId: string,
  proposalIds: string[],
): Promise<Set<string>> {
  if (!supabaseConfigured() || proposalIds.length === 0) return new Set();
  const service = getServiceSupabase();
  const { data } = await service
    .from('counter_proposal_endorsements')
    .select('counter_proposal_id')
    .eq('user_id', userId)
    .in('counter_proposal_id', proposalIds);
  return new Set((data ?? []).map((row) => row.counter_proposal_id));
}

export async function findHearingLinkForSak(sakId: string): Promise<CounterProposalHearingLink | null> {
  try {
    const hearings = await fetchStortingetHoringer();
    const matches = findHoringerForSak(hearings, sakId);
    const preferred =
      matches.find((hearing) => isHoringOpen(hearing)) ??
      matches[0] ??
      null;
    if (!preferred) return null;
    const deadline = getHoringInnspillDeadline(preferred);
    return {
      id: String(preferred.id),
      title: getHoringTitle(preferred),
      komite: preferred.komite?.navn ?? null,
      deadlineAt: deadline?.toISOString() ?? null,
      deadlineLabel: formatHoringDeadlineSummary(preferred),
      open: isHoringOpen(preferred),
    };
  } catch (error) {
    console.warn('findHearingLinkForSak', error);
    return null;
  }
}

export async function createCounterProposal(options: {
  userId: string;
  issueId: string;
  title: string;
  body: string;
  hearing?: CounterProposalHearingLink | null;
}): Promise<string> {
  if (!supabaseConfigured()) {
    throw new Error('Tjenesten er ikke konfigurert');
  }
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('create_counter_proposal', {
    p_user_id: options.userId,
    p_stortinget_issue_id: options.issueId,
    p_title: options.title.trim(),
    p_body: options.body.trim(),
    p_stortinget_hearing_id: options.hearing?.id ?? null,
    p_hearing_deadline_at: options.hearing?.deadlineAt ?? null,
    p_support_threshold: COUNTER_PROPOSAL_DEFAULT_THRESHOLD,
  });

  if (error) {
    const message = error.message || '';
    if (message.toLowerCase().includes('duplicate') || error.code === '23505') {
      throw new Error('Du har allerede et motforslag på denne saken');
    }
    throw error;
  }

  const proposalId = String(data);
  await counterProposalCreatedAward(options.userId, proposalId);
  await syncUserBadges(options.userId);
  return proposalId;
}

export async function endorseCounterProposal(userId: string, proposalId: string) {
  if (!supabaseConfigured()) {
    throw new Error('Tjenesten er ikke konfigurert');
  }

  const service = getServiceSupabase();
  const { data, error } = await service.rpc('endorse_counter_proposal', {
    p_user_id: userId,
    p_counter_proposal_id: proposalId,
  });

  if (error) throw error;

  await counterProposalEndorsedAward(userId, proposalId);
  const proposal = await getCounterProposal(proposalId);
  if (proposal && canPackageCounterProposal(proposal) && proposal.status === 'threshold_met') {
    await packageCounterProposal({ proposalId, force: false });
  }

  return data as {
    counterProposalId: string;
    supportCount: number;
    supportThreshold: number;
    status: CounterProposalStatus;
    endorsed: boolean;
  };
}

export async function packageCounterProposal(options: {
  proposalId: string;
  force?: boolean;
  actorUserId?: string;
  actorEmail?: string | null;
  sakTitle?: string;
}): Promise<{ packaged: boolean; webhookTriggered: boolean; markdown: string | null }> {
  const proposal = await getCounterProposal(options.proposalId);
  if (!proposal) {
    throw new Error('Motforslag ikke funnet');
  }

  if (!canPackageCounterProposal(proposal) && !options.force) {
    throw new Error('Support threshold not met');
  }

  if (options.force) {
    if (!options.actorUserId || !(await isAdmin(options.actorUserId, options.actorEmail))) {
      throw new Error('Kun admin kan tvinge pakking');
    }
  }

  const hearing = proposal.stortingetHearingId
    ? await findHearingLinkForSak(proposal.stortingetIssueId)
    : await findHearingLinkForSak(proposal.stortingetIssueId);

  const pkg = buildCounterProposalPackage({
    proposal,
    sakTitle: options.sakTitle || `Sak ${proposal.stortingetIssueId}`,
    hearing: hearing
      ? {
          id: hearing.id,
          title: hearing.title,
          komite: hearing.komite,
          deadlineAt: hearing.deadlineAt,
        }
      : undefined,
  });

  const webhookTriggered = triggerHearingInnspillWebhook({
    ...pkg,
    markdown: counterProposalPackageToMarkdown(pkg),
  });

  const service = getServiceSupabase();
  const { data, error } = await service.rpc('mark_counter_proposal_packaged', {
    p_counter_proposal_id: proposal.id,
    p_payload: pkg,
    p_webhook_triggered: webhookTriggered,
  });

  if (error) {
    console.error('mark_counter_proposal_packaged', error);
    throw new Error('Kunne ikke pakke motforslaget');
  }

  return {
    packaged: data === true,
    webhookTriggered,
    markdown: counterProposalPackageToMarkdown(pkg),
  };
}

export async function packageReadyCounterProposals(limit = 20): Promise<{
  considered: number;
  packaged: number;
}> {
  if (!supabaseConfigured()) return { considered: 0, packaged: 0 };
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('counter_proposals')
    .select('id')
    .eq('status', 'threshold_met')
    .is('packaged_at', null)
    .order('updated_at', { ascending: true })
    .limit(limit);

  if (error || !data) return { considered: 0, packaged: 0 };

  let packaged = 0;
  for (const row of data) {
    try {
      const result = await packageCounterProposal({ proposalId: row.id });
      if (result.packaged) packaged += 1;
    } catch (err) {
      console.warn('packageReadyCounterProposals', row.id, err);
    }
  }

  return { considered: data.length, packaged };
}

export { COUNTER_PROPOSAL_BODY_MIN, COUNTER_PROPOSAL_TITLE_MIN };
