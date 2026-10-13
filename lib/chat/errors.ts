/**
 * Maps low-level chat failures to honest Norwegian copy so users never see the
 * English AI SDK default ("An error occurred.").
 */

export const CHAT_ERROR_DEFAULT = 'Noe gikk galt i samtalen. Prøv igjen.';
export const CHAT_ERROR_RATE_LIMIT = 'Du har sendt mange meldinger på kort tid. Vent litt og prøv igjen.';
export const CHAT_ERROR_NETWORK = 'Fikk ikke kontakt med Stemme+. Sjekk nettverket og prøv igjen.';

export function chatErrorMessage(error: unknown): string {
  const raw =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : '';

  const message = raw.trim().toLowerCase();

  if (!message || message === 'an error occurred.') return CHAT_ERROR_DEFAULT;
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return CHAT_ERROR_RATE_LIMIT;
  }
  if (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network error') ||
    message.includes('load failed')
  ) {
    return CHAT_ERROR_NETWORK;
  }
  if (message.includes('unauthorized') || message.includes('api key')) {
    return 'Nøkkelen din ble avvist. Oppdater modellnøkkelen under Stemme+-innstillingene.';
  }

  return CHAT_ERROR_DEFAULT;
}
