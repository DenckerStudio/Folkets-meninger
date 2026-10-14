import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { normalizeEmailFrequencyByChannel } from '@/lib/notifications/preferences';
import {
  NOTIFICATION_PREFERENCE_COLUMNS,
  normalizeNotificationPreferences,
  isMissingColumnError,
} from '@/lib/notifications/filters';
import { normalizeFrequenciesForTier } from '@/lib/stemme-plus/gates';
import { getOwnSubscription } from '@/lib/stemme-plus/service';
import { isStemmePlusActive } from '@/lib/stemme-plus/tier';

export const dynamic = 'force-dynamic';

const LEGACY_COLUMNS = 'email_enabled,email_frequency_by_channel';
const ALL_COLUMNS = `${LEGACY_COLUMNS},${NOTIFICATION_PREFERENCE_COLUMNS}`;

type SupabaseServer = Awaited<ReturnType<typeof getServerSupabase>>;

async function loadRow(supabase: SupabaseServer, userId: string) {
  const full = await supabase
    .from('notification_preferences')
    .select(ALL_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  if (!full.error || !isMissingColumnError(full.error)) {
    return { data: full.data as Record<string, unknown> | null, error: full.error, hasV2: true };
  }
  // Migration 20261014160000_notification_preferences_v2 not applied yet.
  const legacy = await supabase
    .from('notification_preferences')
    .select(LEGACY_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  return { data: legacy.data as Record<string, unknown> | null, error: legacy.error, hasV2: false };
}

function buildResponse(
  row: Record<string, unknown> | null,
  subscription: Awaited<ReturnType<typeof getOwnSubscription>>,
  hasV2: boolean,
) {
  const isPlus = isStemmePlusActive(subscription);
  return {
    preferences: {
      email_enabled: (row?.email_enabled as boolean | null | undefined) ?? true,
      email_frequency_by_channel: normalizeFrequenciesForTier(
        normalizeEmailFrequencyByChannel((row?.email_frequency_by_channel ?? null) as Record<string, unknown> | null),
        subscription,
      ),
      ...normalizeNotificationPreferences(hasV2 ? row : null, isPlus),
    },
    stemme_plus: isPlus,
    v2_available: hasV2,
  };
}

export async function GET() {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
    }

    const loaded = await loadRow(supabase, user.id);
    if (loaded.error) {
      console.error('Preferences fetch error', loaded.error);
      return NextResponse.json({ error: 'Kunne ikke hente innstillinger' }, { status: 500 });
    }

    let row = loaded.data;
    if (!row) {
      const { error: insertError } = await supabase.from('notification_preferences').insert({
        user_id: user.id,
        email_frequency_by_channel: normalizeEmailFrequencyByChannel(null),
      });
      if (insertError) {
        console.error('Preferences insert error', insertError);
        return NextResponse.json({ error: 'Kunne ikke opprette innstillinger' }, { status: 500 });
      }
      row = (await loadRow(supabase, user.id)).data;
    }

    const subscription = await getOwnSubscription(user.id);
    return NextResponse.json(buildResponse(row, subscription, loaded.hasV2));
  } catch (e) {
    console.error('Preferences GET error', e);
    return NextResponse.json({ error: 'En feil oppstod' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
    }

    const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
    }

    const subscription = await getOwnSubscription(user.id);
    const isPlus = isStemmePlusActive(subscription);

    const legacyUpdate: Record<string, unknown> = { user_id: user.id };
    if (typeof payload.email_enabled === 'boolean') legacyUpdate.email_enabled = payload.email_enabled;
    if (payload.email_frequency_by_channel && typeof payload.email_frequency_by_channel === 'object') {
      legacyUpdate.email_frequency_by_channel = normalizeFrequenciesForTier(
        normalizeEmailFrequencyByChannel(payload.email_frequency_by_channel as Record<string, unknown>),
        subscription,
      );
    }

    const touchesV2 = NOTIFICATION_PREFERENCE_COLUMNS.split(',').some((key) => key in payload);
    const current = await loadRow(supabase, user.id);
    if (current.error) {
      console.error('Preferences fetch error', current.error);
      return NextResponse.json({ error: 'Kunne ikke hente innstillinger' }, { status: 500 });
    }

    if (touchesV2 && !current.hasV2) {
      return NextResponse.json(
        { error: 'Nye varslingsinnstillinger er ikke tilgjengelige ennå (databasen mangler migrering).' },
        { status: 503 },
      );
    }

    const update: Record<string, unknown> = { ...legacyUpdate };
    if (touchesV2) {
      // Merge with stored values, then normalize for tier: free users always get
      // the free defaults for Stemme+ fields (A, B, C, e-post, frekvens).
      const merged = normalizeNotificationPreferences({ ...(current.data ?? {}), ...payload }, isPlus);
      Object.assign(update, merged);
    }

    const { error } = await supabase.from('notification_preferences').upsert(update, { onConflict: 'user_id' });
    if (error) {
      console.error('Preferences update error', error);
      return NextResponse.json({ error: 'Kunne ikke lagre innstillinger' }, { status: 500 });
    }

    const saved = await loadRow(supabase, user.id);
    return NextResponse.json(buildResponse(saved.data, subscription, saved.hasV2));
  } catch (e) {
    console.error('Preferences POST error', e);
    return NextResponse.json({ error: 'En feil oppstod' }, { status: 500 });
  }
}
