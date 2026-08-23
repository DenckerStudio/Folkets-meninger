import { NextResponse } from 'next/server';
import {
  filterKalenderEventsByWindow,
  hearingsToKalenderEvents,
} from '@/lib/kalender-events';
import { buildHoringerIcs, resolveKalenderSiteOrigin } from '@/lib/kalender-ics';
import { fetchStortingetHoringer } from '@/lib/stortinget-horinger';

export const revalidate = 3600;

export async function GET() {
  try {
    const hearings = await fetchStortingetHoringer();
    const events = filterKalenderEventsByWindow(hearingsToKalenderEvents(hearings), {
      pastDays: 90,
      futureDays: 90,
    });
    const origin = resolveKalenderSiteOrigin();
    const ics = buildHoringerIcs(events, origin);

    return new NextResponse(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="horinger.ics"',
        'Cache-Control': 'public, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Failed to build hearings ICS:', error);
    return NextResponse.json({ error: 'Klarte ikke å hente høringskalender' }, { status: 502 });
  }
}
