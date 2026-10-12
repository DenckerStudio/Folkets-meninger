import {
  opinionInnspillCreatedAward,
  opinionInnspillEndorsedAward,
} from '@/lib/knowledge/award';
import { syncUserBadges } from '@/lib/knowledge/service';
import { getCitizenOpinion } from '@/lib/opinions/service';
import { getAnonSupabase, getServiceSupabase } from '@/lib/supabase';
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
  buildOpinionInnspillPackage,
  canPackageOpinionInnspill,
  opinionInnspillPackageToMarkdown,
} from './package';
import {
  OPINION_INNSPILL_DEFAULT_THRESHOLD,
  type OpinionInnspillHearingLink,
  type OpinionInnspillRecord,
  type OpinionInnspillStatus,
} from './types';

type OpinionInnspillRow = {
  opinion_id: string;
  author_user_id: string;
  status: OpinionInnspillStatus;
  support_threshold: number;
  support_count: number;
  stortinget_hearing_id: string | null;
  hearing_deadline_at: string | null;
  packaged_at: string | null;
  created_at: string;
};

const INNSPILL_SELECT = `
  opinion_id,
  author_user_id,
  status,
  support_threshold,
  support_count,
  stortinget_hearing_id,
  hearing_deadline_at,
  packaged_at,
  created_at
`;

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function mapRow(row: OpinionInnspillRow, authorName: string | null = null): OpinionInnspillRecord {
  return {
    opinionId: row.opinion_id,
    authorUserId: row.author_user_id,
    authorName,
    status: row.status,
    supportThreshold: row.support_threshold,
    supportCount: row.support_count,
    stortingetHearingId: row.stortinget_hearing_id,
    hearingDeadlineAt: row.hearing_deadline_at,
    packagedAt: row.packaged_at,
    createdAt: row.created_at,
  };
}

async function authorName(userId: string): Promise<string | null> {
  if (!supabaseConfigured()) return null;
  const service = getServiceSupabase();
  const { data } = await service
    .from('users')
    .select('first_name, last_name, name')
    .eq('id', userId)
    .maybeSingle();
  if (!data) return null;
  const full =
    data.first_name && data.last_name ? `${data.first_name} ${data.last_name}`.trim() : data.name;
  return full ?? null;
}

export async function getOpinionInnspill(opinionId: string): Promise<OpinionInnspillRecord | null> {
  if (!supabaseConfigured() || !opinionId) return null;
  const supabase = getAnonSupabase();
  const { data, error } = await supabase
    .from('opinion_innspill')
    .select(INNSPILL_SELECT)
    .eq('opinion_id', opinionId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as OpinionInnspillRow;
  return mapRow(row, await authorName(row.author_user_id));
}

export async function userEndorsedOpinionInnspillIds(
  userId: string | null,
  opinionIds: string[],
): Promise<Set<string>> {
  if (!userId || opinionIds.length === 0 || !supabaseConfigured()) return new Set();
  const service = getServiceSupabase();
  const { data } = await service
    .from('opinion_innspill_endorsements')
    .select('opinion_id')
    .eq('user_id', userId)
    .in('opinion_id', opinionIds);
  return new Set((data ?? []).map((row) => String(row.opinion_id)));
}

export async function findHearingLinkForSak(sakId: string): Promise<OpinionInnspillHearingLink | null> {
  try {
    const hearings = await fetchStortingetHoringer();
    const matches = findHoringerForSak(hearings, sakId);
    const preferred = matches.find((hearing) => isHoringOpen(hearing)) ?? matches[0] ?? null;
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

export async function createOpinionInnspill(options: {
  userId: string;
  opinionId: string;
  issueId: string;
  hearing?: OpinionInnspillHearingLink | null;
}): Promise<void> {
  if (!supabaseConfigured()) {
    throw new Error('Tjenesten er ikke konfigurert');
  }
  const service = getServiceSupabase();
  const { error } = await service.rpc('create_opinion_innspill', {
    p_user_id: options.userId,
    p_opinion_id: options.opinionId,
    p_stortinget_hearing_id: options.hearing?.id ?? null,
    p_hearing_deadline_at: options.hearing?.deadlineAt ?? null,
    p_support_threshold: OPINION_INNSPILL_DEFAULT_THRESHOLD,
  });
  if (error) throw new Error(error.message || 'Kunne ikke fremme innspillet');

  await opinionInnspillCreatedAward(options.userId, options.opinionId);
  await syncUserBadges(options.userId).catch((err) => console.warn('syncUserBadges', err));
}

export async function endorseOpinionInnspill(
  userId: string,
  opinionId: string,
): Promise<{
  opinionId: string;
  supportCount: number;
  supportThreshold: number;
  status: OpinionInnspillStatus;
  endorsed: boolean;
}> {
  if (!supabaseConfigured()) {
    throw new Error('Tjenesten er ikke konfigurert');
  }
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('endorse_opinion_innspill', {
    p_user_id: userId,
    p_opinion_id: opinionId,
  });
  if (error) throw new Error(error.message || 'Kunne ikke registrere støtte');

  const result = data as {
    support_count?: number;
    support_threshold?: number;
    status?: OpinionInnspillStatus;
    endorsed?: boolean;
  };
  const endorsed = Boolean(result.endorsed);
  if (endorsed) {
    await opinionInnspillEndorsedAward(userId, opinionId).catch((err) =>
      console.warn('opinionInnspillEndorsedAward', err),
    );
  }
  return {
    opinionId,
    supportCount: result.support_count ?? 0,
    supportThreshold: result.support_threshold ?? OPINION_INNSPILL_DEFAULT_THRESHOLD,
    status: result.status ?? 'gathering',
    endorsed,
  };
}

export async function packageOpinionInnspill(options: {
  opinionId: string;
  sakTitle: string;
  force?: boolean;
}): Promise<{ packaged: boolean; webhookTriggered: boolean; markdown: string | null }> {
  const innspill = await getOpinionInnspill(options.opinionId);
  if (!innspill) throw new Error('Innspill ikke funnet');
  if (!canPackageOpinionInnspill(innspill) && !options.force) {
    throw new Error('Støtteterskelen er ikke nådd');
  }

  const opinion = await getCitizenOpinion(options.opinionId);
  if (!opinion) throw new Error('Mening ikke funnet');
  if (!opinion.stortingetIssueId) {
    throw new Error('Meningen er ikke knyttet til en sak');
  }

  const hearing = await findHearingLinkForSak(opinion.stortingetIssueId);
  const pkg = buildOpinionInnspillPackage({
    innspill,
    opinion,
    sakId: opinion.stortingetIssueId,
    sakTitle: opinion.issueTitle || options.sakTitle || `Sak ${opinion.stortingetIssueId}`,
    hearing,
  });

  const webhookTriggered = triggerHearingInnspillWebhook({
    ...pkg,
    markdown: opinionInnspillPackageToMarkdown(pkg),
  });

  const service = getServiceSupabase();
  const { data, error } = await service.rpc('mark_opinion_innspill_packaged', {
    p_opinion_id: options.opinionId,
    p_payload: pkg,
    p_webhook_triggered: webhookTriggered,
  });
  if (error) {
    console.error('mark_opinion_innspill_packaged', error);
    throw new Error('Kunne ikke pakke innspillet');
  }

  return {
    packaged: data === true,
    webhookTriggered,
    markdown: opinionInnspillPackageToMarkdown(pkg),
  };
}

export async function packageReadyOpinionInnspill(limit = 20): Promise<{
  considered: number;
  packaged: number;
}> {
  if (!supabaseConfigured()) return { considered: 0, packaged: 0 };
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('opinion_innspill')
    .select('opinion_id')
    .eq('status', 'threshold_met')
    .is('packaged_at', null)
    .order('updated_at', { ascending: true })
    .limit(limit);
  if (error || !data) return { considered: 0, packaged: 0 };

  let packaged = 0;
  for (const row of data) {
    try {
      const result = await packageOpinionInnspill({ opinionId: String(row.opinion_id), sakTitle: '' });
      if (result.packaged) packaged += 1;
    } catch (err) {
      console.warn('packageReadyOpinionInnspill', row.opinion_id, err);
    }
  }
  return { considered: data.length, packaged };
}
