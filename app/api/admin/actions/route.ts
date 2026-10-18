import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import {
  createManualActionPollDraft,
  getActionClusterById,
  listActionClusters,
  listActionSourcesForCluster,
  mergeActionClusters,
  updateActionCluster,
  updateActionPollDraft,
} from '@/lib/actions/service';
import type { ActionClusterStatus } from '@/lib/actions/types';
import { publishPoll } from '@/lib/polls/service';

export const dynamic = 'force-dynamic';

const STATUSES: ActionClusterStatus[] = [
  'would_draft',
  'manual_only',
  'blocked',
  'below_threshold',
  'drafted',
  'rejected',
  'not_action',
  'candidate',
];

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const clusterId = url.searchParams.get('clusterId');
  const status =
    statusParam && STATUSES.includes(statusParam as ActionClusterStatus)
      ? (statusParam as ActionClusterStatus)
      : 'all';

  if (clusterId) {
    const cluster = await getActionClusterById(clusterId);
    if (!cluster) {
      return NextResponse.json({ error: 'Klynge ikke funnet' }, { status: 404 });
    }
    const sources = await listActionSourcesForCluster(clusterId);
    return NextResponse.json({ cluster, sources });
  }

  const clusters = await listActionClusters({ status, limit: 150 });
  return NextResponse.json({ clusters });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Serveren er ikke konfigurert' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const action = typeof body.action === 'string' ? body.action : null;
    const clusterId = typeof body.clusterId === 'string' ? body.clusterId : null;

    if (!action || !clusterId) {
      return NextResponse.json({ error: 'Mangler handling eller clusterId' }, { status: 400 });
    }

    const adminId = auth.userId ?? null;

    switch (action) {
      case 'reject': {
        const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
        await updateActionCluster(clusterId, {
          status: 'rejected',
          rejectReason: reason || 'Avvist av admin',
          decidedBy: adminId,
        });
        break;
      }
      case 'not_action': {
        await updateActionCluster(clusterId, {
          status: 'not_action',
          rejectReason: 'Ikke en aksjon',
          decidedBy: adminId,
        });
        break;
      }
      case 'publish': {
        const pollId = typeof body.pollId === 'string' ? body.pollId : null;
        if (!pollId) {
          return NextResponse.json({ error: 'Mangler pollId' }, { status: 400 });
        }
        await publishPoll(pollId);
        break;
      }
      case 'edit_poll': {
        const pollId = typeof body.pollId === 'string' ? body.pollId : null;
        const title = typeof body.title === 'string' ? body.title.trim() : undefined;
        const neutralSummary =
          typeof body.neutralSummary === 'string' ? body.neutralSummary.trim() : undefined;
        if (!pollId) {
          return NextResponse.json({ error: 'Mangler pollId' }, { status: 400 });
        }
        await updateActionPollDraft(pollId, { title, neutralSummary });
        break;
      }
      case 'merge': {
        const targetId = typeof body.targetClusterId === 'string' ? body.targetClusterId : null;
        if (!targetId) {
          return NextResponse.json({ error: 'Mangler targetClusterId' }, { status: 400 });
        }
        await mergeActionClusters(targetId, clusterId, adminId);
        break;
      }
      case 'manual_draft': {
        const title = typeof body.title === 'string' ? body.title.trim() : '';
        const neutralSummary = typeof body.neutralSummary === 'string' ? body.neutralSummary.trim() : '';
        const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : '';
        const result = await createManualActionPollDraft(clusterId, {
          title,
          neutralSummary,
          sourceUrl,
          scaleValue: typeof body.scaleValue === 'number' ? body.scaleValue : null,
          scaleUnit: typeof body.scaleUnit === 'string' ? body.scaleUnit : null,
          scaleSourceUrl: typeof body.scaleSourceUrl === 'string' ? body.scaleSourceUrl : null,
          scaleAsOf: typeof body.scaleAsOf === 'string' ? body.scaleAsOf : null,
          approvedByAdmin: adminId ?? 'admin',
        });
        if (!result.pollId) {
          return NextResponse.json({ ok: false, reason: result.reason }, { status: 409 });
        }
        return NextResponse.json({ ok: true, pollId: result.pollId });
      }
      default:
        return NextResponse.json({ error: 'Ukjent handling' }, { status: 400 });
    }

    const cluster = await getActionClusterById(clusterId);
    const sources = cluster ? await listActionSourcesForCluster(clusterId) : [];
    return NextResponse.json({ ok: true, cluster, sources });
  } catch (error) {
    console.error('Admin actions patch failed', error);
    return NextResponse.json({ error: 'Kunne ikke oppdatere aksjon' }, { status: 500 });
  }
}
