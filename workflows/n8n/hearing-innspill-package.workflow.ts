/**
 * Pakker motforslag som strukturert horingsinnspill.
 *
 * Appen kaller N8N_HEARING_INNSPILL_WEBHOOK_URL med JSON-rapporten.
 * n8n lagrer hendelsen og varsler admin via appen. Dette er ikke et Stortinget-API.
 */
import { expr, ifElse, node, sticky, trigger, workflow } from '@n8n/workflow-sdk';
import { FOLKETS_APP_BASE } from './n8n-supabase.shared';

const webhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Motforslag innspill',
    parameters: {
      httpMethod: 'POST',
      path: 'folkets-hearing-innspill',
      responseMode: 'responseNode',
    },
  },
  output: [
    {
      body: {
        markdown: '# Innspill',
        sak: { id: '200329', title: 'Eksempel' },
        proposal: { supportCount: 10 },
      },
    },
  ],
});

const prepare = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Forbered rapport',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const item = $input.first()?.json || {};
const payload = item.body || item;
const sakId = payload.sak?.id || payload.sakId || null;
const title = payload.sak?.title || sakId || 'ukjent sak';
const subject = 'Motforslag-innspill: ' + title;
const markdown = String(payload.markdown || '').trim();
const supportCount = Number(payload.proposal?.supportCount || payload.supportCount || 0);
return [{
  json: {
    subject,
    markdown,
    disclaimer: payload.disclaimer || '',
    sakId,
    hearingId: payload.hearing?.id || null,
    supportCount,
    hasReport: markdown.length > 20,
  },
}];`,
    },
  },
  output: [{ subject: 'Motforslag-innspill', hasReport: true, sakId: '200329' }],
});

const hasReport = ifElse({
  version: 2.2,
  config: {
    name: 'Has report?',
    parameters: {
      looseTypeValidation: true,
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'has-report',
            leftValue: expr('{{ $json.hasReport }}'),
            rightValue: true,
            operator: { type: 'boolean', operation: 'equals' },
          },
        ],
      },
    },
  },
});

const notifyAdmin = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Varsle admin',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: `${FOLKETS_APP_BASE}/api/ops/n8n-notify`,
      sendHeaders: true,
      headerParameters: {
        parameters: [{ name: 'x-cron-secret', value: expr("{{ $('Notify settings').item.json.cronSecret }}") }],
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '={{ JSON.stringify({ kind: "hearing", subject: $json.subject, text: $json.markdown, meta: { sakId: $json.sakId, hearingId: $json.hearingId, supportCount: $json.supportCount } }) }}',
      ),
      options: { timeout: 30000 },
    },
  },
  output: [{ ok: true }],
});

const notifySettings = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Notify settings',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'cron-secret', name: 'cronSecret', value: '', type: 'string' },
        ],
      },
    },
  },
  output: [{ cronSecret: '' }],
});

const respondOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond ok',
    parameters: {
      respondWith: 'json',
      responseBody: expr(
        '{{ { ok: true, sakId: $("Forbered rapport").item.json.sakId, notified: true } }}',
      ),
    },
  },
});

const respondEmpty = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond empty',
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ { ok: true, skipped: true, reason: "empty_report" } }}'),
    },
  },
});

const pipelineErrorTrigger = trigger({
  type: 'n8n-nodes-base.errorTrigger',
  version: 1,
  config: { name: 'Pipeline error' },
  output: [{ workflow: { name: 'folkets-hearing-innspill-package' }, execution: { id: '0' } }],
});

const recordPipelineError = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Record pipeline error',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          {
            id: 'fallback',
            name: 'appFallback',
            type: 'string',
            value: 'App logs webhook failure; motforslag-rapporten ligger i payload og kan sendes på nytt',
          },
        ],
      },
    },
  },
  output: [{ appFallback: 're-post N8N_HEARING_INNSPILL_WEBHOOK_URL' }],
});

sticky(
  '## Motforslag → horingsinnspill\n\nWebhook fra appen. Fyll inn cronSecret i Notify settings (samme som CRON_SECRET). Ikke et Stortinget-API. Error Trigger logger; appen dropper ikke rapporten stille.',
  [webhook, pipelineErrorTrigger],
  { color: 4 },
);

export default workflow(
  'folkets-hearing-innspill-package',
  'Folkets Stemme – Motforslag horingsinnspill',
)
  .add(webhook)
  .to(prepare)
  .to(notifySettings)
  .to(hasReport.onTrue(notifyAdmin.to(respondOk)).onFalse(respondEmpty))
  .add(pipelineErrorTrigger)
  .to(recordPipelineError);
