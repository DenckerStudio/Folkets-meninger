import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { isAdminLocalAiHubEnabled } from '@/lib/admin/local-ai-hub/flags';
import { loadLocalAiRunnerStatus } from '@/lib/admin/local-ai-hub/runner-status-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdminLocalAiHubEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const status = await loadLocalAiRunnerStatus();
  return NextResponse.json(status, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
