import { requireAdmin } from '@/lib/admin/gate';
import { prepareAboutSuggestionRefresh } from '@/lib/blog/about-suggestions-assemble';
import {
  enrichAboutSuggestionFeedback,
  reconcileOrphanAboutSuggestions,
} from '@/lib/blog/about-suggestions-draft-link';
import { loadAboutSuggestionSources } from '@/lib/blog/about-suggestions-sources';
import type { AboutSuggestionSourceBundle } from '@/lib/blog/about-suggestions-sources';
import {
  ABOUT_SUGGESTIONS_TABLE_MISSING_MESSAGE,
  applyAboutSuggestionPlan,
  listAboutSuggestionRows,
  reopenAboutSuggestion,
  setAboutSuggestionStatus,
} from '@/lib/blog/about-suggestions-store';
import type { AboutSuggestionStored } from '@/lib/blog/about-suggestions-store';
import { aboutSuggestionSourceLabel, type AboutSuggestion } from '@/lib/blog/about-suggestions';
import { cmsBlogOpsLookup } from '@/lib/cms/blog-ops-client';
import { getSearxngBaseUrl } from '@/lib/chat/searxng';

export { ABOUT_SUGGESTIONS_TABLE_MISSING_MESSAGE };

const SUGGESTION_KEY = /^[a-z0-9:_-]{3,160}$/;
const FEEDBACK_ACTIONS = ['dismiss', 'snooze'] as const;
type FeedbackAction = (typeof FEEDBACK_ACTIONS)[number];

export type AboutSuggestionsApiResponse = {
  status: number;
  body: Record<string, unknown>;
};

export type AboutSuggestionsApiDeps = {
  requireAdmin: typeof requireAdmin;
  listRows: typeof listAboutSuggestionRows;
  loadSources: typeof loadAboutSuggestionSources;
  applyPlan: typeof applyAboutSuggestionPlan;
  setStatus: typeof setAboutSuggestionStatus;
  prepare: typeof prepareAboutSuggestionRefresh;
  lookupPost: typeof cmsBlogOpsLookup;
  reopenOrphan: typeof reopenAboutSuggestion;
  searxngConfigured: () => boolean;
  now: () => Date;
};

export const aboutSuggestionsApiDeps: AboutSuggestionsApiDeps = {
  requireAdmin,
  listRows: listAboutSuggestionRows,
  loadSources: loadAboutSuggestionSources,
  applyPlan: applyAboutSuggestionPlan,
  setStatus: setAboutSuggestionStatus,
  prepare: prepareAboutSuggestionRefresh,
  lookupPost: cmsBlogOpsLookup,
  reopenOrphan: reopenAboutSuggestion,
  searxngConfigured: () => getSearxngBaseUrl() !== null,
  now: () => new Date(),
};

function serializeSuggestion(item: AboutSuggestion) {
  const mention = item.provenance.mentionUrl;
  return {
    key: item.key,
    title: item.title,
    angle: item.angle,
    reason: item.reason,
    source: item.source,
    source_label: aboutSuggestionSourceLabel(item.source),
    related_title: item.related?.title ?? null,
    related_kind: item.related?.kind ?? null,
    evergreen: item.evergreen,
    mention_url: mention && /^https?:\/\//i.test(mention) ? mention : null,
    interest_only: item.provenance.interestOnly === true,
  };
}

function storedToSuggestion(row: AboutSuggestionStored): AboutSuggestion {
  return {
    key: row.key,
    title: row.title,
    angle: row.angle,
    reason: row.reason,
    source: row.source,
    related: row.related,
    provenance: row.provenance,
    evergreen: row.evergreen,
  };
}

function storeErrorBody(result: { missing: boolean; message: string }): Record<string, unknown> {
  return {
    error: result.missing ? 'table_missing' : 'save_failed',
    message: result.message,
  };
}

function statusForAction(action: FeedbackAction): 'dismissed' | 'snoozed' {
  switch (action) {
    case 'dismiss':
      return 'dismissed';
    case 'snooze':
      return 'snoozed';
    default: {
      const unhandled: never = action;
      return unhandled;
    }
  }
}

async function activeOpenSuggestions(
  rows: AboutSuggestionStored[],
  deps: AboutSuggestionsApiDeps,
): Promise<AboutSuggestion[]> {
  const reconciled = await reconcileOrphanAboutSuggestions({
    rows,
    lookupPost: deps.lookupPost,
    reopen: deps.reopenOrphan,
  });
  return reconciled
    .filter((row) => row.status === 'open')
    .map(storedToSuggestion);
}

function searxngNote(configured: boolean): string[] {
  if (configured) return [];
  return ['Nettsøk er ikke satt opp på serveren. Forslagene under bruker bare data vi allerede har.'];
}

export async function handleAboutSuggestionsList(
  deps: AboutSuggestionsApiDeps = aboutSuggestionsApiDeps,
): Promise<AboutSuggestionsApiResponse> {
  const auth = await deps.requireAdmin();
  if (!auth.ok) return { status: auth.status, body: { error: auth.error } };

  const listed = await deps.listRows();
  if (!listed.ok) return { status: listed.status, body: storeErrorBody(listed) };

  const open = await activeOpenSuggestions(listed.rows, deps);
  return {
    status: 200,
    body: {
      suggestions: open.map(serializeSuggestion),
      has_history: listed.rows.length > 0,
      searxng_configured: deps.searxngConfigured(),
      notes: searxngNote(deps.searxngConfigured()),
    },
  };
}

export async function handleAboutSuggestionsRefresh(
  deps: AboutSuggestionsApiDeps = aboutSuggestionsApiDeps,
): Promise<AboutSuggestionsApiResponse> {
  const auth = await deps.requireAdmin();
  if (!auth.ok) return { status: auth.status, body: { error: auth.error } };

  const listed = await deps.listRows();
  if (!listed.ok) return { status: listed.status, body: storeErrorBody(listed) };

  let sources: AboutSuggestionSourceBundle;
  try {
    sources = await deps.loadSources();
  } catch {
    console.error('[blog] kunne ikke samle grunnlag for forslag');
    return {
      status: 502,
      body: { error: 'source_failed', message: 'Kunne ikke hente grunnlaget for forslagene. Prøv igjen.' },
    };
  }

  const reconciled = await reconcileOrphanAboutSuggestions({
    rows: listed.rows,
    lookupPost: deps.lookupPost,
    reopen: deps.reopenOrphan,
  });
  const existing = await enrichAboutSuggestionFeedback({
    rows: reconciled,
    lookupPost: deps.lookupPost,
  });
  const prepared = deps.prepare({
    input: {
      written: sources.written,
      changelog: sources.changelog,
      roadmap: sources.roadmap,
      research: sources.research,
      webHits: sources.webHits,
    },
    existing,
    now: deps.now(),
  });
  const saved = await deps.applyPlan(prepared.plan);
  if (!saved.ok) return { status: saved.status, body: storeErrorBody(saved) };

  return {
    status: 200,
    body: {
      suggestions: prepared.visible.map(serializeSuggestion),
      has_history: true,
      searxng_configured: sources.searxngConfigured,
      cms_state: sources.cmsState,
      notes: sources.notes,
    },
  };
}

function parseFeedback(body: unknown): { ok: true; key: string; action: FeedbackAction } | { ok: false; message: string } {
  if (!body || typeof body !== 'object') return { ok: false, message: 'Ugyldig forespørsel' };
  const record = body as Record<string, unknown>;
  const action = record.action;
  if (action === 'refresh') return { ok: false, message: 'Ugyldig forespørsel' };
  if (typeof action !== 'string' || !(FEEDBACK_ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, message: 'Ugyldig forespørsel' };
  }
  const key = typeof record.suggestion_key === 'string' ? record.suggestion_key.trim() : '';
  if (!SUGGESTION_KEY.test(key)) return { ok: false, message: 'Ugyldig forslagsnøkkel' };
  return { ok: true, key, action: action as FeedbackAction };
}

export async function handleAboutSuggestionsPost(
  request: Request,
  deps: AboutSuggestionsApiDeps = aboutSuggestionsApiDeps,
): Promise<AboutSuggestionsApiResponse> {
  const auth = await deps.requireAdmin();
  if (!auth.ok) return { status: auth.status, body: { error: auth.error } };

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { status: 400, body: { error: 'invalid_json', message: 'Ugyldig JSON' } };
  }

  if (json && typeof json === 'object' && (json as { action?: unknown }).action === 'refresh') {
    return handleAboutSuggestionsRefresh(deps);
  }

  if (json && typeof json === 'object' && (json as { action?: unknown }).action === 'use') {
    const key =
      typeof (json as { suggestion_key?: unknown }).suggestion_key === 'string'
        ? (json as { suggestion_key: string }).suggestion_key.trim()
        : '';
    if (!SUGGESTION_KEY.test(key)) {
      return { status: 400, body: { error: 'invalid_input', message: 'Ugyldig forslagsnøkkel' } };
    }
    return { status: 200, body: { ok: true, suggestion_key: key, action: 'use' } };
  }

  const parsed = parseFeedback(json);
  if (!parsed.ok) return { status: 400, body: { error: 'invalid_input', message: parsed.message } };

  const saved = await deps.setStatus({
    key: parsed.key,
    status: statusForAction(parsed.action),
    userId: auth.userId,
    now: deps.now(),
  });
  if (!saved.ok) {
    const error = saved.missing ? 'table_missing' : saved.status === 404 ? 'not_found' : 'save_failed';
    return { status: saved.status, body: { error, message: saved.message } };
  }
  return { status: 200, body: { ok: true, suggestion_key: parsed.key, action: parsed.action } };
}
