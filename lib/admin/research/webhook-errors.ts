export const RESEARCH_WEBHOOK_ENV_KEYS = [
  'N8N_RESEARCH_WEBHOOK_BASE',
  'N8N_RESEARCH_WEBHOOK_SECRET',
  'N8N_RESEARCH_WEBHOOK_TOKEN',
] as const;

export function getMissingResearchWebhookEnvKeys(): string[] {
  const missing: string[] = [];
  if (!process.env.N8N_RESEARCH_WEBHOOK_BASE?.replace(/\/+$/, '').trim()) {
    missing.push('N8N_RESEARCH_WEBHOOK_BASE');
  }
  if (!process.env.N8N_RESEARCH_WEBHOOK_SECRET?.trim()) {
    missing.push('N8N_RESEARCH_WEBHOOK_SECRET');
  }
  if (!process.env.N8N_RESEARCH_WEBHOOK_TOKEN?.trim()) {
    missing.push('N8N_RESEARCH_WEBHOOK_TOKEN');
  }
  return missing;
}

export type ResearchWebhookFailureInput =
  | { reason: 'not_configured' }
  | { reason: 'timeout' }
  | { reason: 'http'; status?: number };

export type ResearchWebhookFailureResponse = {
  code: string;
  message: string;
  briefError: string;
  httpStatus: number;
};

export function mapResearchWebhookFailure(
  input: ResearchWebhookFailureInput,
): ResearchWebhookFailureResponse {
  if (input.reason === 'not_configured') {
    const missing = getMissingResearchWebhookEnvKeys();
    const names =
      missing.length > 0 ? missing.join(', ') : RESEARCH_WEBHOOK_ENV_KEYS.join(', ');
    return {
      code: 'research_webhook_not_configured',
      message: `Research-webhook er ikke konfigurert. Mangler: ${names}.`,
      briefError: 'arbeidsflyt_utilgjengelig',
      httpStatus: 503,
    };
  }

  if (input.reason === 'timeout') {
    return {
      code: 'research_webhook_timeout',
      message: 'n8n svarte ikke i tide. Prøv igjen senere.',
      briefError: 'webhook_timeout',
      httpStatus: 504,
    };
  }

  const status = input.status ?? 502;

  if (status === 404) {
    return {
      code: 'research_webhook_inactive',
      message: 'Arbeidsflyten er ikke aktiv i n8n.',
      briefError: 'webhook_http_404',
      httpStatus: 502,
    };
  }

  if (status === 401 || status === 403) {
    return {
      code: 'research_webhook_unauthorized',
      message: 'Webhook-token ble avvist.',
      briefError: `webhook_http_${status}`,
      httpStatus: 502,
    };
  }

  if (status >= 500) {
    return {
      code: 'research_webhook_upstream_error',
      message: `n8n svarer ikke akkurat nå (feilkode ${status}). Prøv igjen senere.`,
      briefError: `webhook_http_${status}`,
      httpStatus: 502,
    };
  }

  return {
    code: 'research_webhook_unreachable',
    message: `Kunne ikke nå n8n (feilkode ${status}). Prøv igjen senere.`,
    briefError: `webhook_http_${status}`,
    httpStatus: 502,
  };
}
