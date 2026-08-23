/**
 * Pakker motforslag som strukturert horingsinnspill.
 *
 * Appen kaller N8N_HEARING_INNSPILL_WEBHOOK_URL med JSON-rapporten.
 * n8n e-poster eller lagrer rapporten — dette er ikke et Stortinget-API.
 */
import { node, sticky, trigger, workflow } from '@n8n/workflow-sdk';

const webhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Motforslag innspill',
    parameters: {
      httpMethod: 'POST',
      path: 'folkets-hearing-innspill',
      responseMode: 'onReceived',
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
const subject = 'Motforslag-innspill: ' + (payload.sak?.title || payload.sak?.id || 'ukjent sak');
return [{
  json: {
    subject,
    markdown: payload.markdown || '',
    disclaimer: payload.disclaimer || '',
    sakId: payload.sak?.id || null,
    hearingId: payload.hearing?.id || null,
    supportCount: payload.proposal?.supportCount || 0,
  },
}];`,
    },
  },
  output: [{ subject: 'Motforslag-innspill' }],
});

sticky(
  '## Motforslag → horingsinnspill\\n\\nWebhook fra appen. Send e-post/Slack manuelt i n8n. Ikke et Stortinget-API.',
  [webhook],
  { color: 4 },
);

export default workflow(
  'folkets-hearing-innspill-package',
  'Folkets Stemme – Motforslag horingsinnspill',
)
  .add(webhook)
  .to(prepare);
