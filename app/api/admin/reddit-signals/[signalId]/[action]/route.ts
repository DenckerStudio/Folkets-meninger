import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import {
  applyRedditSignalAdminAction,
  isRedditSignalApiAction,
  type RedditSignalActionBody,
} from '@/lib/reddit-signals/actions';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ signalId: string; action: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { signalId, action } = await context.params;
  if (!signalId?.trim() || !isRedditSignalApiAction(action)) {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  let body: RedditSignalActionBody = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === 'object') {
      body = parsed as RedditSignalActionBody;
    }
  } catch {
    body = {};
  }

  const result = await applyRedditSignalAdminAction(
    signalId.trim(),
    action,
    auth.userId,
    body,
  );

  if (!result.ok) {
    const status =
      result.code === 'not_found' ? 404 : result.code === 'validation' ? 400 : 500;
    return NextResponse.json({ error: result.code, message: result.message }, { status });
  }

  return NextResponse.json({ ok: true, status: result.status });
}