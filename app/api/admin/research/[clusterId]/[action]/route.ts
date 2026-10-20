import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { isResearchApiAction } from '@/lib/admin/research/actions';
import { parseClientResearchRequestId } from '@/lib/admin/research/request-id';
import {
  RESEARCH_API_ERROR_CODES,
  researchApiErrorMessage,
} from '@/lib/admin/research/api-error-codes';
import { enqueueResearchJob } from '@/lib/admin/research/service';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ clusterId: string; action: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { clusterId, action } = await context.params;
  if (!clusterId?.trim() || !isResearchApiAction(action)) {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON-body' }, { status: 400 });
  }

  const requestId = parseClientResearchRequestId(body);
  if (!requestId) {
    return NextResponse.json({ error: 'request_id må være en gyldig UUID' }, { status: 400 });
  }

  const result = await enqueueResearchJob(clusterId.trim(), action, auth.userId, requestId);
  if (!result.ok) {
    if (result.code === RESEARCH_API_ERROR_CODES.requestConflict) {
      return NextResponse.json(
        {
          error: RESEARCH_API_ERROR_CODES.requestConflict,
          message: researchApiErrorMessage(RESEARCH_API_ERROR_CODES.requestConflict),
        },
        { status: 409 },
      );
    }
    if (result.code === RESEARCH_API_ERROR_CODES.briefActive && result.requestId) {
      return NextResponse.json(
        {
          error: RESEARCH_API_ERROR_CODES.briefActive,
          message: researchApiErrorMessage(RESEARCH_API_ERROR_CODES.briefActive),
          request_id: result.requestId,
          status: result.status ?? 'queued',
        },
        { status: 409 },
      );
    }
    if (result.code === 'not_found') {
      return NextResponse.json({ error: 'Klyngen finnes ikke' }, { status: 404 });
    }
    if (result.code === 'not_configured') {
      return NextResponse.json(
        { error: 'Research-webhook er ikke konfigurert' },
        { status: 503 },
      );
    }
    if (result.code === 'webhook_failed') {
      return NextResponse.json(
        { error: 'Kunne ikke nå research-webhook' },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: 'Kunne ikke opprette research-oppgave' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    request_id: result.requestId,
    status: result.status,
    created: result.created,
  });
}
