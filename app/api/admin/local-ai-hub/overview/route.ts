import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { isAdminLocalAiHubEnabled } from '@/lib/admin/local-ai-hub/flags';
import { loadLocalAiOverview } from '@/lib/admin/local-ai-hub/overview';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdminLocalAiHubEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const overview = await loadLocalAiOverview();
  return NextResponse.json(overview);
}