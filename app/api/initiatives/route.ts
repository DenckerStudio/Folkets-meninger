import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { isForumAdmin } from '@/lib/forum/admin';
import {
  createCitizenInitiative,
  endorseCitizenInitiative,
  getCitizenInitiative,
  listCitizenInitiatives,
  promoteCitizenInitiativeToPoll,
  userHasEndorsedInitiative,
} from '@/lib/polls/service';
import { CITIZEN_INITIATIVE_DEFAULT_THRESHOLD } from '@/lib/polls/norway-counties';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    const initiatives = await listCitizenInitiatives(40);
    return NextResponse.json({ initiatives });
  }

  const initiative = await getCitizenInitiative(id);
  if (!initiative) {
    return NextResponse.json({ error: 'Initiativ ikke funnet' }, { status: 404 });
  }

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let endorsed = false;
  if (user) {
    endorsed = await userHasEndorsedInitiative(user.id, id);
  }

  return NextResponse.json({ initiative, endorsed });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = typeof body.action === 'string' ? body.action : 'create';

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

    if (action === 'create') {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const text = typeof body.body === 'string' ? body.body.trim() : '';
      const threshold =
        typeof body.supportThreshold === 'number' && body.supportThreshold > 0
          ? Math.floor(body.supportThreshold)
          : CITIZEN_INITIATIVE_DEFAULT_THRESHOLD;

      if (title.length < 5 || text.length < 20) {
        return NextResponse.json(
          { error: 'Tittel (min. 5) og begrunnelse (min. 20 tegn) er påkrevd' },
          { status: 400 },
        );
      }

      try {
        const initiativeId = await createCitizenInitiative({
          userId: user.id,
          title,
          body: text,
          supportThreshold: threshold,
        });
        return NextResponse.json({ success: true, initiativeId });
      } catch (error) {
        const msg = error instanceof Error ? error.message : '';
        if (msg.toLowerCase().includes('forum identity')) {
          return NextResponse.json(
            { error: 'Fullfør profilen med fornavn og etternavn først' },
            { status: 400 },
          );
        }
        throw error;
      }
    }

    if (action === 'endorse') {
      const initiativeId = typeof body.initiativeId === 'string' ? body.initiativeId : null;
      if (!initiativeId) {
        return NextResponse.json({ error: 'Mangler initiativ-ID' }, { status: 400 });
      }
      const result = await endorseCitizenInitiative(user.id, initiativeId);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'promote') {
      const initiativeId = typeof body.initiativeId === 'string' ? body.initiativeId : null;
      if (!initiativeId) {
        return NextResponse.json({ error: 'Mangler initiativ-ID' }, { status: 400 });
      }

      const force = Boolean(body.force);
      if (force && !(await isForumAdmin(user.id, user.email))) {
        return NextResponse.json({ error: 'Kun admin kan tvinge oppgradering' }, { status: 403 });
      }

      const pollId = await promoteCitizenInitiativeToPoll({
        initiativeId,
        actorUserId: user.id,
        force,
      });
      return NextResponse.json({ success: true, pollId });
    }

    return NextResponse.json({ error: 'Ukjent handling' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const combined = message.toLowerCase();
    if (combined.includes('threshold not met')) {
      return NextResponse.json({ error: 'Støtteterskelen er ikke nådd ennå' }, { status: 400 });
    }
    if (combined.includes('not open for endorsements')) {
      return NextResponse.json({ error: 'Initiativet tar ikke imot flere støtteerklæringer' }, { status: 403 });
    }
    console.error('Citizen initiative error:', error);
    return NextResponse.json({ error: 'Kunne ikke behandle initiativ' }, { status: 500 });
  }
}
