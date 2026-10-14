import { NextResponse } from 'next/server';
import { checkDiscussionContent } from '@/lib/moderation/content-check';
import { createCitizenOpinionReply, getCitizenOpinion } from '@/lib/opinions/service';
import { notifyIssueStanceHoldersOnReply } from '@/lib/opinions/notify-reply';
import { hasOpinionFieldErrors, isOpinionStance, validateReplyDraft } from '@/lib/opinions/validate';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { PUBLIC_IDENTITY_ERROR } from '@/lib/identity/public-identity';
import { checkRateLimit } from '@/lib/rate-limit';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  const ip = clientIp(request);
  const ipRate = checkRateLimit(`opinions:reply:ip:${ip}`, 20, 60_000);
  if (!ipRate.ok) {
    return NextResponse.json(
      { error: 'For mange forespørsler. Prøv igjen om litt.' },
      {
        status: 429,
        headers: { 'Retry-After': String(ipRate.retryAfterSeconds) },
      },
    );
  }

  const userRate = checkRateLimit(`opinions:reply:user:${user.id}`, 10, 60_000);
  if (!userRate.ok) {
    return NextResponse.json(
      { error: 'Du svarer for ofte. Vent litt før du publiserer på nytt.' },
      {
        status: 429,
        headers: { 'Retry-After': String(userRate.retryAfterSeconds) },
      },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  const text = typeof body.body === 'string' ? body.body : '';
  const stance = body.stance;
  const isQuick = body.quick === true;
  const fieldErrors = validateReplyDraft({ body: text, stance, quick: isQuick });
  if (hasOpinionFieldErrors(fieldErrors)) {
    return NextResponse.json(
      { error: fieldErrors.body || fieldErrors.stance, fieldErrors },
      { status: 400 },
    );
  }

  // Skip moderation for blank stance or quick stance (empty body with for/imot)
  const isQuickStance = isQuick && text.trim() === '' && (stance === 'for' || stance === 'imot');
  if (!(isOpinionStance(stance) && (stance === 'blank' || isQuickStance))) {
    const moderation = checkDiscussionContent(text);
    if (!moderation.approved) {
      return NextResponse.json({ error: moderation.reason }, { status: 400 });
    }
  }

  try {
    await ensurePublicUser(user);
    const replyId = await createCitizenOpinionReply(user.id, id, { body: text, stance, quick: isQuickStance });

    // Notify users who hold a stance on this sak (B8). Best-effort.
    try {
      const opinion = await getCitizenOpinion(id);
      if (opinion?.stortingetIssueId) {
        await notifyIssueStanceHoldersOnReply({
          replyAuthorUserId: user.id,
          opinionId: id,
          opinionTitle: opinion.title,
          issueId: opinion.stortingetIssueId,
          issueTitle: opinion.issueTitle,
        });
      }
    } catch (notifyError) {
      console.error('Opinion reply notification error:', notifyError);
    }

    return NextResponse.json({ success: true, replyId });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const combined = message.toLowerCase();
    if (combined.includes('first and last name') || combined.includes('public identity')) {
      return NextResponse.json({ error: PUBLIC_IDENTITY_ERROR }, { status: 400 });
    }
    if (combined.includes('your own opinion')) {
      return NextResponse.json({ error: 'Du kan ikke svare på din egen mening' }, { status: 400 });
    }
    if (combined.includes('not found')) {
      return NextResponse.json({ error: 'Meningen ble ikke funnet' }, { status: 404 });
    }
    // After migration 20261014150000_quick_stance_empty_reply_body.sql is applied,
    // the DB accepts empty body for quick 'for'/'imot' stances and this 409 falls away.
    if (combined.includes('body must be between 80 and 4000 characters')) {
      return NextResponse.json(
        { error: 'Rask stemme krever en databaseoppdatering', code: 'quick_stance_db_unsupported' },
        { status: 409 },
      );
    }
    console.error('Create citizen opinion reply error:', error);
    return NextResponse.json({ error: 'Kunne ikke lagre svaret' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  // Only allow deleting the user's own quick stance reply (empty body)
  const { data: reply, error: replyError } = await supabase
    .from('citizen_opinion_replies')
    .select('id, body')
    .eq('opinion_id', id)
    .eq('author_user_id', user.id)
    .eq('is_removed', false)
    .maybeSingle();

  if (replyError) {
    console.error('Delete stance: fetch reply error:', replyError.message);
    return NextResponse.json({ error: 'Kunne ikke finne stemme' }, { status: 500 });
  }

  if (!reply) {
    return NextResponse.json({ error: 'Ingen stemme å fjerne' }, { status: 404 });
  }

  // Only allow deletion if body is empty (quick stance)
  if (reply.body && reply.body.trim().length > 0) {
    return NextResponse.json({ error: 'Kan ikke fjerne begrunnelse her' }, { status: 400 });
  }

  // Soft delete by setting is_removed = true
  const { error: deleteError } = await supabase
    .from('citizen_opinion_replies')
    .update({ is_removed: true, updated_at: new Date().toISOString() })
    .eq('id', reply.id);

  if (deleteError) {
    console.error('Delete stance error:', deleteError.message);
    return NextResponse.json({ error: 'Kunne ikke fjerne stemme' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
