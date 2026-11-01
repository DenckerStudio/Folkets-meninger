import { NextResponse } from 'next/server';
import { listAiSummariesForReview } from '@/lib/admin/ai-summary-review';
import { requireAdmin } from '@/lib/admin/gate';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: 'Serveren er ikke konfigurert' }, { status: 503 });
  }

  try {
    const summaries = await listAiSummariesForReview(80);
    return NextResponse.json({ summaries });
  } catch (error) {
    console.error('[ai-summary-review] liste feilet', error);
    return NextResponse.json({ error: 'Kunne ikke hente sammendrag' }, { status: 500 });
  }
}
