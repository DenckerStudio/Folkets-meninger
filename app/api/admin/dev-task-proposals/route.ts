import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { listDevTaskProposalsForAdmin } from '@/lib/admin/dev-task-proposals/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await listDevTaskProposalsForAdmin();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error.includes('finnes ikke') ? 503 : 500 });
  }

  return NextResponse.json({ proposals: result.proposals });
}
