import { NextResponse } from 'next/server';
import { userHasPoliticalConsent } from '@/lib/consent/service';
import type { PoliticalConsentPurpose } from '@/lib/consent/political-consent';
import { getServiceSupabase } from '@/lib/supabase';

export async function ensurePoliticalConsent(
  userId: string,
  purpose: PoliticalConsentPurpose,
): Promise<NextResponse | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Samtykke er ikke konfigurert på serveren.' }, { status: 503 });
  }

  const service = getServiceSupabase();
  const allowed = await userHasPoliticalConsent(service, userId, purpose);
  if (!allowed) {
    return NextResponse.json(
      {
        error: 'Du må gi samtykke til behandling av politiske holdninger før du kan fortsette.',
        code: 'POLITICAL_CONSENT_REQUIRED',
        purpose,
      },
      { status: 403 },
    );
  }

  return null;
}
