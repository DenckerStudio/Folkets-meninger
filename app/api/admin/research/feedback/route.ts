import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import {
  saveClusterFeedback,
  type ClusterFeedbackValue,
} from '@/lib/admin/research/feedback-adapter';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let clusterId = '';
  let value: ClusterFeedbackValue | null = null;
  try {
    const body = await request.json();
    if (typeof body.clusterId === 'string') clusterId = body.clusterId.trim();
    if (body.value === 'like' || body.value === 'dislike') value = body.value;
  } catch {
    return NextResponse.json({ error: 'Ugyldig body' }, { status: 400 });
  }

  if (!clusterId || !value) {
    return NextResponse.json({ error: 'Mangler clusterId eller value' }, { status: 400 });
  }

  await saveClusterFeedback({ clusterId, userId: auth.userId, value });
  return NextResponse.json({ ok: true });
}
