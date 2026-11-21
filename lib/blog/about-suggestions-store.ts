import {
  ABOUT_SUGGESTION_SNOOZE_DAYS,
  ABOUT_SUGGESTION_SOURCES,
  type AboutSuggestion,
  type AboutSuggestionFeedback,
  type AboutSuggestionProvenance,
  type AboutSuggestionSource,
  type AboutSuggestionStatus,
  type AboutSuggestionWritePlan,
  type AboutWrittenKind,
} from '@/lib/blog/about-suggestions';
import { getServiceSupabase } from '@/lib/supabase';

export const ABOUT_SUGGESTIONS_TABLE_MISSING_MESSAGE =
  'Forslagstabellen er ikke lagt inn i databasen ennå. Du kan fortsatt lage utkast nedenfor.';

const TABLE = 'about_blog_suggestions';

const SELECT_COLUMNS =
  'suggestion_key, title, angle, reason, source, status, related_title, related_kind, provenance, draft_request_id, source_event, snooze_until';

export type AboutSuggestionStored = AboutSuggestion & {
  status: AboutSuggestionStatus;
  snoozeUntil: string | null;
};

type StoreFailure = { ok: false; missing: boolean; status: number; message: string };

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const message = error.message ?? '';
  return /about_blog_suggestions/i.test(message) && /does not exist|schema cache|could not find/i.test(message);
}

function failure(error: { code?: string; message?: string }, fallback: string): StoreFailure {
  if (isMissingTable(error)) {
    return {
      ok: false,
      missing: true,
      status: 503,
      message: ABOUT_SUGGESTIONS_TABLE_MISSING_MESSAGE,
    };
  }
  console.error('[blog] forslagstabell', error.code ?? 'ukjent');
  return { ok: false, missing: false, status: 500, message: fallback };
}

function isSource(value: string): value is AboutSuggestionSource {
  return (ABOUT_SUGGESTION_SOURCES as readonly string[]).includes(value);
}

function isStatus(value: string): value is AboutSuggestionStatus {
  return value === 'open' || value === 'used' || value === 'dismissed' || value === 'snoozed';
}

function readProvenance(value: unknown): AboutSuggestionProvenance {
  if (!value || typeof value !== 'object') return {};
  const row = value as Record<string, unknown>;
  const mentionUrl = typeof row.mentionUrl === 'string' ? row.mentionUrl.trim() : '';
  return {
    clusterId: typeof row.clusterId === 'string' ? row.clusterId : undefined,
    topicId: typeof row.topicId === 'string' ? row.topicId : undefined,
    changelogId: typeof row.changelogId === 'string' ? row.changelogId : undefined,
    roadmapId: typeof row.roadmapId === 'string' ? row.roadmapId : undefined,
    mentionUrl: /^https?:\/\//i.test(mentionUrl) ? mentionUrl : undefined,
    interestOnly: row.interestOnly === true,
  };
}

function mapRow(raw: Record<string, unknown>): AboutSuggestionStored | null {
  const key = typeof raw.suggestion_key === 'string' ? raw.suggestion_key : '';
  const title = typeof raw.title === 'string' ? raw.title : '';
  const source = typeof raw.source === 'string' ? raw.source : '';
  const status = typeof raw.status === 'string' ? raw.status : '';
  const reason = typeof raw.reason === 'string' ? raw.reason : '';
  if (!key || !title || !reason || !isSource(source) || !isStatus(status)) return null;
  const relatedTitle = typeof raw.related_title === 'string' ? raw.related_title.trim() : '';
  const relatedKind = raw.related_kind === 'utkast' || raw.related_kind === 'publisert' ? raw.related_kind : null;
  return {
    key,
    title,
    angle: typeof raw.angle === 'string' ? raw.angle : '',
    reason,
    source,
    related: relatedTitle && relatedKind ? { title: relatedTitle, kind: relatedKind as AboutWrittenKind } : null,
    provenance: readProvenance(raw.provenance),
    evergreen: source === 'staende',
    status,
    snoozeUntil: typeof raw.snooze_until === 'string' ? raw.snooze_until : null,
  };
}

function cleanProvenance(provenance: AboutSuggestionProvenance): Record<string, string | boolean> {
  const entries = Object.entries(provenance).filter((entry): entry is [string, string | boolean] => {
    const value = entry[1];
    return typeof value === 'string' || typeof value === 'boolean';
  });
  return Object.fromEntries(entries);
}

function toDbRow(item: AboutSuggestion, status: AboutSuggestionStatus) {
  return {
    suggestion_key: item.key,
    title: item.title.slice(0, 110),
    angle: item.angle.slice(0, 600),
    reason: item.reason.slice(0, 400),
    source: item.source,
    status,
    related_title: item.related?.title.slice(0, 200) ?? null,
    related_kind: item.related?.kind ?? null,
    provenance: cleanProvenance(item.provenance),
    snooze_until: null,
  };
}

export async function listAboutSuggestionRows(): Promise<
  { ok: true; rows: AboutSuggestionStored[] } | StoreFailure
> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_COLUMNS)
    .order('updated_at', { ascending: false });
  if (error) return failure(error, 'Kunne ikke hente forslagene.');
  const rows = (data ?? [])
    .map((row) => mapRow(row as Record<string, unknown>))
    .filter((row): row is AboutSuggestionStored => row !== null);
  return { ok: true, rows };
}

export function feedbackFromStored(rows: AboutSuggestionStored[]): AboutSuggestionFeedback[] {
  return rows.map((row) => ({
    key: row.key,
    title: row.title,
    status: row.status,
    snoozeUntil: row.snoozeUntil,
  }));
}

export async function applyAboutSuggestionPlan(plan: AboutSuggestionWritePlan): Promise<
  { ok: true } | StoreFailure
> {
  const supabase = getServiceSupabase();
  if (plan.insert.length > 0) {
    const { error } = await supabase.from(TABLE).insert(plan.insert.map((item) => toDbRow(item, 'open')));
    if (error) return failure(error, 'Kunne ikke lagre nye forslag.');
  }

  for (const item of plan.update) {
    const { error } = await supabase
      .from(TABLE)
      .update({
        title: item.title.slice(0, 110),
        angle: item.angle.slice(0, 600),
        reason: item.reason.slice(0, 400),
        source: item.source,
        status: 'open',
        related_title: item.related?.title.slice(0, 200) ?? null,
        related_kind: item.related?.kind ?? null,
        provenance: cleanProvenance(item.provenance),
        snooze_until: null,
      })
      .eq('suggestion_key', item.key)
      .in('status', ['open', 'snoozed']);
    if (error) return failure(error, 'Kunne ikke oppdatere forslagene.');
  }

  if (plan.deleteKeys.length > 0) {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .in('suggestion_key', plan.deleteKeys)
      .eq('status', 'open');
    if (error) return failure(error, 'Kunne ikke rydde utdaterte forslag.');
  }

  return { ok: true };
}

export async function setAboutSuggestionStatus(args: {
  key: string;
  status: 'used' | 'dismissed' | 'snoozed';
  userId: string;
  now?: Date;
  requestId?: string | null;
  sourceEvent?: string | null;
}): Promise<{ ok: true } | StoreFailure> {
  const supabase = getServiceSupabase();
  const now = args.now ?? new Date();
  const patch: Record<string, unknown> = {
    status: args.status,
    acted_by: args.userId,
    snooze_until:
      args.status === 'snoozed'
        ? new Date(now.getTime() + ABOUT_SUGGESTION_SNOOZE_DAYS * 24 * 60 * 60 * 1000).toISOString()
        : null,
  };
  if (args.requestId) patch.draft_request_id = args.requestId;
  if (args.sourceEvent) patch.source_event = args.sourceEvent;

  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('suggestion_key', args.key)
    .select('suggestion_key')
    .maybeSingle();
  if (error) return failure(error, 'Kunne ikke lagre valget.');
  if (!data) {
    return { ok: false, missing: false, status: 404, message: 'Forslaget finnes ikke lenger.' };
  }
  return { ok: true };
}
