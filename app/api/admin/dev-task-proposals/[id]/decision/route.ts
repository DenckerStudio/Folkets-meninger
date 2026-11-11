import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/gate';
import {
  buildDevTaskProposalDecisionPatch,
  resolveDevTaskProposalDecision,
} from '@/lib/admin/dev-task-proposals/transitions';
import { applyDevTaskProposalDecision } from '@/lib/admin/dev-task-proposals/service';
import {
  DEV_TASK_PROPOSAL_DECISION_ACTIONS,
  type DevTaskProposalStatus,
} from '@/lib/admin/dev-task-proposals/types';

export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    action: z.enum(DEV_TASK_PROPOSAL_DECISION_ACTIONS),
    currentStatus: z.enum(['til_godkjenning', 'i_prosess', 'ferdig', 'avslatt']),
  })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Ugyldig id' }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  const transition = resolveDevTaskProposalDecision(
    parsed.data.currentStatus as DevTaskProposalStatus,
    parsed.data.action,
  );
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: 409 });
  }

  const patch = buildDevTaskProposalDecisionPatch(transition, auth.userId, new Date().toISOString());
  const updated = await applyDevTaskProposalDecision(id, patch);
  if (!updated.ok) {
    return NextResponse.json({ error: updated.error }, { status: updated.status });
  }

  return NextResponse.json({ ok: true, status: transition.nextStatus });
}
