/**
 * Shared n8n error handler for Folkets Stemme production workflows.
 *
 * Live: https://n8n.heyklever.app/workflow/iBNVwqPIsvf0JmTc (published)
 * Wired as settings.errorWorkflow on AI summary, embeddings, Reels draft,
 * app cron, hearing innspill, and pipeline-helse.
 *
 * POSTs to POST /api/ops/n8n-notify (x-cron-secret). App logs the failure
 * and emails ops when SMTP is configured. App-side queue backup remains
 * GET /api/cron/n8n-retry.
 */
import { node, sticky, trigger, workflow, expr } from '@n8n/workflow-sdk';

const errorTrigger = trigger({
  type: 'n8n-nodes-base.errorTrigger',
  version: 1,
  config: { name: 'Error Trigger' },
  output: [
    {
      workflow: { id: 'unknown', name: 'folkets-workflow' },
      execution: { id: '0', url: '' },
      error: { message: 'Example node failure' },
    },
  ],
});

const formatError = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Format error',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const item = $input.first()?.json || {};
const workflowName = item.workflow?.name || item.workflowName || 'ukjent workflow';
const workflowId = item.workflow?.id || item.workflowId || '';
const executionId = item.execution?.id || item.executionId || '';
const executionUrl = item.execution?.url || (executionId ? ('https://n8n.heyklever.app/execution/' + executionId) : '');
const lastNode = item.lastNodeExecuted || item.node?.name || '';
const message = item.error?.message || item.message || 'Ukjent feil';
const subject = 'n8n-feil: ' + workflowName;
const text = [
  'Workflow: ' + workflowName,
  workflowId ? 'ID: ' + workflowId : null,
  lastNode ? 'Siste node: ' + lastNode : null,
  executionUrl ? 'Kjøring: ' + executionUrl : null,
  '',
  message,
].filter(Boolean).join('\\n');
return [{ json: { subject, text, meta: { workflowName, workflowId, executionId, executionUrl, lastNode } } }];`,
    },
  },
  output: [
    {
      subject: 'n8n-feil: folkets-workflow',
      text: 'Workflow: folkets-workflow',
      meta: { workflowName: 'folkets-workflow' },
    },
  ],
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
          {
            id: 'cron-secret',
            name: 'cronSecret',
            type: 'string',
            value: '',
          },
        ],
      },
    },
  },
  output: [{ cronSecret: '' }],
});

const notifyAdmin = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Varsle admin',
    parameters: {
      method: 'POST',
      url: 'https://www.folkets-stemme.no/api/ops/n8n-notify',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          {
            name: 'x-cron-secret',
            value: expr("{{ $('Notify settings').item.json.cronSecret }}"),
          },
        ],
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '{{ JSON.stringify({ kind: "error", subject: $("Format error").item.json.subject, text: $("Format error").item.json.text, meta: $("Format error").item.json.meta }) }}',
      ),
      options: { timeout: 30000 },
    },
  },
  output: [{ ok: true }],
});

sticky(
  '## Folkets n8n error handler\\n\\nPublisert som iBNVwqPIsvf0JmTc. Fyll cronSecret (samme som CRON_SECRET). Appen logger + e-post via /api/ops/n8n-notify. Køen droppes ikke: /api/cron/n8n-retry.',
  [errorTrigger],
  { color: 1 },
);

export default workflow(
  'folkets-n8n-error-handler',
  'Folkets Stemme – n8n feilvarsling',
)
  .add(errorTrigger)
  .to(formatError.to(notifySettings).to(notifyAdmin));
