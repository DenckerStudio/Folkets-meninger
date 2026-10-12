'use client';

import { PREFERENCE_KEYS } from '@/lib/preferences/keys';
import { readLocalStorage } from '@/lib/preferences/local-storage';

/**
 * Raw browser-local impact profile (fylke/housing/car/occupation), forwarded to
 * `/api/chat` so the getImpact tool can personalize without persisting anything
 * server-side. Read fresh at send time so profile edits apply immediately.
 */
export function readImpactProfileForChat(): unknown {
  return readLocalStorage<unknown>(PREFERENCE_KEYS.impact.profile);
}
