import { NextResponse } from 'next/server';
import { recordHearingUserInterest } from '@/lib/hearing-interest/service';
import { getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  const { id } = await params;
  const hearingId = id.trim();
  if (!hearingId) {
    return NextResponse.json({ error: 'Ugyldig høring' }, { status: 400 });
  }

  let body: { follow?: boolean } = {};
  try {
    body = (await request.json()) as { follow?: boolean };
  } catch {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  if (typeof body.follow !== 'boolean') {
    return NextResponse.json({ error: 'Mangler follow' }, { status: 400 });
  }

  const result = await recordHearingUserInterest({
    userId: user.id,
    stortingetHearingId: hearingId,
    follow: body.follow,
  });

  if (!result.ok) {
    return NextResponse.json({ error: 'Kunne ikke lagre' }, { status: 500 });
  }

  return NextResponse.json({ following: body.follow });
}