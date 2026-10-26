/** Profile / BYOK settings (user is already on the settings page). */
export const BYOK_OLLAMA_UNREACHABLE_SETTINGS_NB =
  'Kunne ikke nå Ollama-serveren. Sjekk adressen.';

/** Chat and other surfaces outside Profil → BYOK. */
export const BYOK_OLLAMA_UNREACHABLE_NB =
  'Kunne ikke nå Ollama-serveren. Sjekk adressen under Profil → Stemme+ (BYOK).';

/** Ollama base-URL hint under Profil → Stemme+ for vanlige brukere. */
export const BYOK_OLLAMA_BASE_URL_HINT_NB =
  'Adressen må være en offentlig http(s)-adresse. Lokale adresser som localhost og 192.168.x/10.x støttes ikke.';

/** Ollama base-URL hint for admins (private URLs via server allowlist only). */
export const BYOK_OLLAMA_BASE_URL_HINT_ADMIN_NB =
  'Offentlige http(s)-adresser fungerer alltid. Som admin kan du bruke en lokal adresse hvis den står på serverens godkjentliste. Det er serveren som kobler til adressen, ikke nettleseren din.';

export function ollamaBaseUrlHintNb(isAdmin: boolean): string {
  return isAdmin ? BYOK_OLLAMA_BASE_URL_HINT_ADMIN_NB : BYOK_OLLAMA_BASE_URL_HINT_NB;
}
