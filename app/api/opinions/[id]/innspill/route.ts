import { NextResponse } from 'next/server';
import { getCitizenOpinion } from '@/lib/opinions/service';
import { getServerSupabase } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  createOpinionInnspill,
  getOpinionInnspill,
  findHearingLinkForSak,
} from '@/lib/innspill/service';

export const dynamic = 'force-dynamic';

async function requireUser() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** POST /api/opinions/[id]/innspill — author submits their opinion as a hearing innspill. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opinionId } = await params;
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  const rate = checkRateLimit(`opinion-innspill:${user.id}`, 10, 60_000);
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'For mange forsøk. Prøv igjen om litt.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
    );
  }

  const opinion = await getCitizenOpinion(opinionId, user.id);
  if (!opinion) {
    return NextResponse.json({ error: 'Mening ikke funnet' }, { status: 404 });
  }
  if (opinion.authorUserId !== user.id) {
    return NextResponse.json(
      { error: 'Bare forfatteren kan fremme sin mening som innspill' },
      { status: 403 },
    );
  }
  if (!opinion.stortingetIssueId) {
    return NextResponse.json(
      { error: 'Meningen må være knyttet til en sak for å bli et innspill' },
      { status: 400 },
    );
  }

  const existing = await getOpinionInnspill(opinionId);
  if (existing) {
    return NextResponse.json({ error: 'Meningen er allerede fremmet som innspill' }, { status: 409 });
  }

  const hearing = await findHearingLinkForSak(opinion.stortingetIssueId);
  try {
    await createOpinionInnspill({
      userId: user.id,
      opinionId,
      issueId: opinion.stortingetIssueId,
      hearing,
    });
    return NextResponse.json({ success: true, hearing });
  } catch (error) {
    console.error('createOpinionInnspill error:', error);
    const message = error instanceof Error ? error.message : 'Kunne ikke fremme innspillet';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
