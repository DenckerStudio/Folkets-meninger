import { NextResponse } from 'next/server';
import { ByokEncryptionNotConfiguredError } from '@/lib/byok/crypto';
import { loadDecryptedByok } from '@/lib/byok/service';
import { byokOutboundForUser } from '@/lib/byok/outbound';
import { generateHearingInnspillDraft } from '@/lib/hearing-innspill/draft';
import { recordHearingUserInterest } from '@/lib/hearing-interest/service';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  fetchStortingetHoringById,
  getHoringTitle,
  isHoringOpen,
} from '@/lib/stortinget-horinger';
import { requireStemmePlus } from '@/lib/stemme-plus/entitlement';
import { getServerSupabase } from '@/lib/supabase-server';
import { trustedClientIp } from '@/lib/trusted-client-ip';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireStemmePlus();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { id } = await params;
  const hearingId = id.trim();
  if (!hearingId) {
    return NextResponse.json({ error: 'Ugyldig høring' }, { status: 400 });
  }

  const ipRate = await checkRateLimit(`hearing-utkast:ip:${trustedClientIp(request)}`, 12, 60_000);
  if (!ipRate.ok) {
    return NextResponse.json(
      { error: 'For mange forespørsler. Prøv igjen om litt.' },
      { status: 429, headers: { 'Retry-After': String(ipRate.retryAfterSeconds) } },
    );
  }

  const userRate = await checkRateLimit(`hearing-utkast:user:${gate.userId}`, 4, 60_000);
  if (!userRate.ok) {
    return NextResponse.json(
      { error: 'Du har bedt om for mange utkast. Vent litt.' },
      { status: 429, headers: { 'Retry-After': String(userRate.retryAfterSeconds) } },
    );
  }

  const hearing = await fetchStortingetHoringById(hearingId).catch(() => null);
  if (!hearing) {
    return NextResponse.json({ error: 'Høring ikke funnet' }, { status: 404 });
  }
  if (!isHoringOpen(hearing)) {
    return NextResponse.json({ error: 'Høringen tar ikke lenger imot innspill' }, { status: 409 });
  }

  const session = await getServerSupabase();
  let credential = null;
  try {
    credential = await loadDecryptedByok(gate.userId, session);
  } catch (error) {
    if (error instanceof ByokEncryptionNotConfiguredError) {
      credential = null;
    } else {
      console.error('[hearing-utkast] decrypt error');
      return NextResponse.json({ error: 'Kunne ikke lese den lagrede nøkkelen.' }, { status: 502 });
    }
  }

  if (!credential) {
    return NextResponse.json(
      { error: 'Lagre en egen LLM-nøkkel under Stemme+ før du lager utkast.' },
      { status: 409 },
    );
  }

  const interest = await recordHearingUserInterest({
    userId: gate.userId,
    stortingetHearingId: hearingId,
    draftOpened: true,
  });
  if (!interest.ok) {
    console.error('record hearing draft interest', interest.error);
  }

  try {
    const outbound = await byokOutboundForUser(gate.userId);
    const generated = await generateHearingInnspillDraft({
      hearingId,
      hearingTitle: getHoringTitle(hearing),
      credential,
      outbound,
      ragClient: session,
    });

    if (!generated.draft) {
      return NextResponse.json(
        {
          error: generated.note ?? 'Kunne ikke lage utkast',
          sources: generated.sources,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      draft: generated.draft,
      sources: generated.sources,
    });
  } catch (error) {
    console.error('hearing utkast error', error);
    return NextResponse.json({ error: 'Kunne ikke lage utkast. Prøv igjen.' }, { status: 502 });
  }
}