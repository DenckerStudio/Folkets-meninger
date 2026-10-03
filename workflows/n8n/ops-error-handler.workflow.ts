/**
 * Shared error handler for Folkets Stemme n8n workflows.
 * Link from other workflows via settings.errorWorkflow after this is published.
 */
import { expr, node, sticky, trigger, workflow } from '@n8n/workflow-sdk';
import { FOLKETS_APP_BASE } from './n8n-supabase.shared';

const errorTrigger = trigger({
  type: 'n8n-nodes-base.errorTrigger',
  version: 1,
  config: {
    name: 'Error Trigger',
    parameters: {},
  },
  output: [
    {
      workflow: { id: 'GP666Zq84qc19tcE', name: 'Folkets Stemme – AI-sammendrag backfill' },
      execution: { id: '100443', url: 'https://n8n.heyklever.app/execution/100443' },
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
return [{
  json: {
    subject,
    text,
    meta: { workflowName, workflowId, executionId, executionUrl, lastNode },
  },
}];`,
    },
  },
  output: [{ subject: 'n8n-feil', text: 'Feil' }],
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
        '={{ JSON.stringify({ kind: "error", subject: $json.subject, text: $json.text, meta: $json.meta }) }}',
      ),
      options: { timeout: 30000 },
    },
  },
  output: [{ ok: true }],
});

sticky(
  '## n8n feilvarsling\n\nKoble denne som error workflow på Folkets-flytene. Fyll inn cronSecret i Notify settings.',
  [errorTrigger],
  { color: 3 },
);

export default workflow(
  'folkets-ops-error-handler',
  'Folkets Stemme – n8n feilvarsling',
)
  .add(errorTrigger)
  .to(formatError)
  .to(notifySettings)
  .to(notifyAdmin);
