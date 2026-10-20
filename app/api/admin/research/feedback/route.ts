import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { RESEARCH_CLUSTER_FEEDBACK_ENABLED } from '@/lib/admin/research/feedback-adapter';

export const dynamic = 'force-dynamic';

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!RESEARCH_CLUSTER_FEEDBACK_ENABLED) {
    return NextResponse.json({ error: 'Ikke tilgjengelig ennå' }, { status: 501 });
  }

  return NextResponse.json({ error: 'Ikke tilgjengelig ennå' }, { status: 501 });
}
