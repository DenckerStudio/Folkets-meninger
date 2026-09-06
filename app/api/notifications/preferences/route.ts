import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { normalizeEmailFrequencyByChannel } from '@/lib/notifications/preferences';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('email_enabled,email_frequency_by_channel')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Preferences GET error', error);
      return NextResponse.json({ error: 'Kunne ikke hente innstillinger' }, { status: 500 });
    }

    if (!data) {
      const defaults = normalizeEmailFrequencyByChannel(null);
      const { data: created, error: insertError } = await supabase
        .from('notification_preferences')
        .insert({
          user_id: user.id,
          email_frequency_by_channel: defaults,
        })
        .select('email_enabled,email_frequency_by_channel')
        .single();

      if (insertError) {
        console.error('Preferences insert error', insertError);
        return NextResponse.json({ error: 'Kunne ikke opprette innstillinger' }, { status: 500 });
      }

      return NextResponse.json({
        preferences: {
          ...created,
          email_frequency_by_channel: normalizeEmailFrequencyByChannel(
            created.email_frequency_by_channel as Record<string, unknown>,
          ),
        },
      });
    }

    return NextResponse.json({
      preferences: {
        ...data,
        email_frequency_by_channel: normalizeEmailFrequencyByChannel(
          data.email_frequency_by_channel as Record<string, unknown>,
        ),
      },
    });
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

    const payload = await request.json();
    const email_enabled = typeof payload.email_enabled === 'boolean' ? payload.email_enabled : undefined;
    const email_frequency_by_channel =
      payload.email_frequency_by_channel && typeof payload.email_frequency_by_channel === 'object'
        ? normalizeEmailFrequencyByChannel(payload.email_frequency_by_channel as Record<string, unknown>)
        : undefined;

    const update: Record<string, unknown> = { user_id: user.id };
    if (email_enabled !== undefined) update.email_enabled = email_enabled;
    if (email_frequency_by_channel !== undefined) {
      update.email_frequency_by_channel = email_frequency_by_channel;
    }

    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert(update, { onConflict: 'user_id' })
      .select('email_enabled,email_frequency_by_channel')
      .single();

    if (error) {
      console.error('Preferences update error', error);
      return NextResponse.json({ error: 'Kunne ikke lagre innstillinger' }, { status: 500 });
    }

    return NextResponse.json({
      preferences: {
        ...data,
        email_frequency_by_channel: normalizeEmailFrequencyByChannel(
          data.email_frequency_by_channel as Record<string, unknown>,
        ),
      },
    });
  } catch (e) {
    console.error('Preferences POST error', e);
    return NextResponse.json({ error: 'En feil oppstod' }, { status: 500 });
  }
}
