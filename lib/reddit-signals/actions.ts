import { getServerSupabase } from '@/lib/supabase-server';
import {
  REDDIT_SIGNAL_API_ACTIONS,
  type RedditSignalApiAction,
  type RedditSignalStatus,
} from '@/lib/reddit-signals/types';

export function isRedditSignalApiAction(value: string): value is RedditSignalApiAction {
  return (REDDIT_SIGNAL_API_ACTIONS as readonly string[]).includes(value);
}

export type RedditSignalActionBody = {
  reason?: string;
};

export type RedditSignalActionResult =
  | { ok: true; status: RedditSignalStatus }
  | { ok: false; code: 'not_found' | 'validation' | 'db_error'; message: string };

function statusForAction(action: RedditSignalApiAction): RedditSignalStatus {
  switch (action) {
    case 'ignorer':
      return 'ignorert';
    case 'blokker':
      return 'blokkert';
    case 'marker_brukt':
      return 'brukt';
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

function feedbackActionForApi(action: RedditSignalApiAction): string {
  switch (action) {
    case 'ignorer':
      return 'ignorert';
    case 'blokker':
      return 'blokkert';
    case 'marker_brukt':
      return 'brukt';
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export function validateRedditSignalActionInput(
  action: RedditSignalApiAction,
  body: RedditSignalActionBody,
): string | null {
  const reason = body.reason?.trim() ?? '';
  if (action === 'ignorer' && reason.length < 3) {
    return 'Oppgi en kort begrunnelse (minst 3 tegn) for å ignorere.';
  }
  if (action === 'blokker' && reason.length < 3) {
    return 'Oppgi en kort begrunnelse (minst 3 tegn) for permanent blokkering.';
  }
  return null;
}

export async function applyRedditSignalAdminAction(
  signalId: string,
  action: RedditSignalApiAction,
  actorUserId: string,
  body: RedditSignalActionBody,
): Promise<RedditSignalActionResult> {
  const validationError = validateRedditSignalActionInput(action, body);
  if (validationError) {
    return { ok: false, code: 'validation', message: validationError };
  }

  const supabase = await getServerSupabase();
  const { data: signal, error: loadError } = await supabase
    .from('reddit_signals')
    .select('id, reddit_id, status')
    .eq('id', signalId)
    .maybeSingle();

  if (loadError) {
    return { ok: false, code: 'db_error', message: 'Kunne ikke hente signal' };
  }
  if (!signal) {
    return { ok: false, code: 'not_found', message: 'Signalet finnes ikke' };
  }

  const reason = body.reason?.trim() || null;
  const nextStatus = statusForAction(action);
  const decidedAt = new Date().toISOString();

  if (action === 'blokker') {
    const { error: blockError } = await supabase.from('reddit_blocklist').upsert(
      {
        reddit_id: signal.reddit_id,
        reason: reason ?? 'Blokkert fra admin',
        created_by: actorUserId,
      },
      { onConflict: 'reddit_id' },
    );
    if (blockError) {
      return { ok: false, code: 'db_error', message: 'Kunne ikke oppdatere blokklisten' };
    }
  }

  const { error: updateError } = await supabase
    .from('reddit_signals')
    .update({
      status: nextStatus,
      status_reason: reason,
      decided_by: actorUserId,
      decided_at: decidedAt,
    })
    .eq('id', signalId);

  if (updateError) {
    return { ok: false, code: 'db_error', message: 'Kunne ikke oppdatere status' };
  }

  const { error: feedbackError } = await supabase.from('reddit_signal_feedback').insert({
    signal_id: signalId,
    action: feedbackActionForApi(action),
    reason,
    actor: actorUserId,
  });

  if (feedbackError) {
    return { ok: false, code: 'db_error', message: 'Kunne ikke logge tilbakemelding' };
  }

  return { ok: true, status: nextStatus };
}