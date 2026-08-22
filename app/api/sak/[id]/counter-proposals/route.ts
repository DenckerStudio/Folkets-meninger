import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getSakPageBundle } from '@/lib/stortinget';
import {
  createCounterProposal,
  endorseCounterProposal,
  findHearingLinkForSak,
  listCounterProposals,
  packageCounterProposal,
  userEndorsedCounterProposalIds,
} from '@/lib/counter-proposals/service';
import {
  COUNTER_PROPOSAL_BODY_MIN,
  COUNTER_PROPOSAL_TITLE_MIN,
} from '@/lib/counter-proposals/types';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [proposals, hearing] = await Promise.all([
    listCounterProposals(id),
    findHearingLinkForSak(id),
  ]);

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const endorsed = user
    ? await userEndorsedCounterProposalIds(
        user.id,
        proposals.map((proposal) => proposal.id),
      )
    : new Set<string>();

  return NextResponse.json({
    proposals,
    hearing,
    endorsedIds: [...endorsed],
    loggedIn: Boolean(user),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Tjenesten er ikke konfigurert' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === 'string' ? body.action : 'create';

  try {
    if (action === 'create') {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const text = typeof body.body === 'string' ? body.body.trim() : '';
      if (title.length < COUNTER_PROPOSAL_TITLE_MIN || text.length < COUNTER_PROPOSAL_BODY_MIN) {
        return NextResponse.json(
          {
            error: `Tittel (min. ${COUNTER_PROPOSAL_TITLE_MIN}) og begrunnelse (min. ${COUNTER_PROPOSAL_BODY_MIN} tegn) er påkrevd`,
          },
          { status: 400 },
        );
      }

      const hearing = await findHearingLinkForSak(id);
      const proposalId = await createCounterProposal({
        userId: user.id,
        issueId: id,
        title,
        body: text,
        hearing,
      });
      return NextResponse.json({ success: true, proposalId });
    }

    if (action === 'endorse') {
      const proposalId = typeof body.proposalId === 'string' ? body.proposalId : '';
      if (!proposalId) {
        return NextResponse.json({ error: 'Mangler motforslag-ID' }, { status: 400 });
      }
      const result = await endorseCounterProposal(user.id, proposalId);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'package') {
      const proposalId = typeof body.proposalId === 'string' ? body.proposalId : '';
      if (!proposalId) {
        return NextResponse.json({ error: 'Mangler motforslag-ID' }, { status: 400 });
      }
      const bundle = await getSakPageBundle(id);
      const result = await packageCounterProposal({
        proposalId,
        force: Boolean(body.force),
        actorUserId: user.id,
        actorEmail: user.email,
        sakTitle: bundle?.sak.title,
      });
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: 'Ukjent handling' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const combined = message.toLowerCase();
    if (combined.includes('public identity')) {
      return NextResponse.json(
        { error: 'Fullfør profilen med fornavn og etternavn først' },
        { status: 400 },
      );
    }
    if (combined.includes('allerede et motforslag')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (combined.includes('threshold not met')) {
      return NextResponse.json({ error: 'Støtteterskelen er ikke nådd ennå' }, { status: 400 });
    }
    if (combined.includes('not open for endorsements')) {
      return NextResponse.json({ error: 'Motforslaget tar ikke imot flere støtteerklæringer' }, { status: 403 });
    }
    if (combined.includes('kun admin')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error('Counter proposal error:', error);
    return NextResponse.json({ error: 'Kunne ikke behandle motforslag' }, { status: 500 });
  }
}
