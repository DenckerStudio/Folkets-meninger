const RESEARCH_BRIEF_ERROR_LABELS: Record<string, string> = {
  tidsavbrudd: 'Oppgaven ble avbrutt etter for lang ventetid i kø.',
  arbeidsflyt_utilgjengelig: 'Arbeidsflyten er ikke tilgjengelig akkurat nå. Prøv igjen senere.',
  webhook_timeout: 'n8n svarte ikke i tide. Prøv igjen senere.',
  webhook_http_404: 'Arbeidsflyten er ikke aktiv i n8n.',
  webhook_http_401: 'Webhook-token ble avvist.',
  webhook_http_403: 'Webhook-token ble avvist.',
  modell_feil: 'Modellen kunne ikke fullføre oppgaven.',
  kilder_mangler: 'Det mangler kilder for å fullføre oppgaven.',
  cms_feil: 'Kunne ikke opprette eller oppdatere innhold i CMS.',
  ugyldig_svar: 'Arbeidsflyten returnerte et ugyldig svar.',
  avbrutt: 'Oppgaven ble avbrutt.',
};

export function formatResearchBriefError(error: string | null | undefined): string | null {
  if (!error?.trim()) return null;
  const trimmed = error.trim();
  const known = RESEARCH_BRIEF_ERROR_LABELS[trimmed];
  if (known) return known;
  if (trimmed.startsWith('webhook_http_')) {
    const statusPart = trimmed.slice('webhook_http_'.length);
    const status = Number.parseInt(statusPart, 10);
    if (Number.isFinite(status) && status >= 500) {
      return `n8n svarer ikke akkurat nå (feilkode ${status}). Prøv igjen senere.`;
    }
    return 'Kunne ikke nå arbeidsflyten. Prøv igjen senere.';
  }
  return trimmed;
}

export const RESEARCH_ALREADY_RUNNING_MESSAGE = 'Denne handlingen kjører allerede.';
