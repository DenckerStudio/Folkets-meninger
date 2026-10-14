import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { getCitizenOpinion } from '@/lib/opinions/service';
import { createOpinionReelDraft, listOpinionReelCandidates } from '@/lib/opinions/reel-candidates';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const candidates = await listOpinionReelCandidates(12);
  return NextResponse.json({ candidates });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { opinionId?: unknown };
  try {
    body = (await request.json()) as { opinionId?: unknown };
  } catch {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  const opinionId = typeof body.opinionId === 'string' ? body.opinionId.trim() : '';
  if (!opinionId) {
    return NextResponse.json({ error: 'Mangler menings-id' }, { status: 400 });
  }

  const opinion = await getCitizenOpinion(opinionId);
  if (!opinion) {
    return NextResponse.json({ error: 'Fant ikke meningen' }, { status: 404 });
  }

  try {
    const draftId = await createOpinionReelDraft(opinion);
    return NextResponse.json({ success: true, draftId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();

    if (lower.includes('already exists')) {
      return NextResponse.json(
        { error: 'Det finnes allerede en reel for denne saken' },
        { status: 409 },
      );
    }
    if (lower.includes('not linked to an issue')) {
      return NextResponse.json({ error: 'Meningen er ikke knyttet til en sak' }, { status: 400 });
    }

    console.error('createOpinionReelDraft failed:', message);
    return NextResponse.json({ error: 'Kunne ikke lage reel-utkast' }, { status: 500 });
  }
}
