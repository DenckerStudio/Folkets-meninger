/**
 * Same-workflow Error Trigger → POST /api/ops/n8n-notify.
 *
 * Live n8n may still use settings.errorWorkflow (iBNVwqPIsvf0JmTc). That
 * setting takes precedence over an in-workflow Error Trigger. This chain is
 * the documented source fallback so a failed Ollama/HTTP node is not
 * console-only. Fill cronSecret in «Error notify settings».
 *
 * App queue backup remains GET /api/cron/n8n-retry (every 2 hours).
 */
import { expr, node, sticky, trigger } from '@n8n/workflow-sdk';
import { FOLKETS_APP_BASE } from './n8n-supabase.shared';

export const FORMAT_WORKFLOW_ERROR_JS = `const item = $input.first()?.json || {};
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
return [{ json: { subject, text, meta: { workflowName, workflowId, executionId, executionUrl, lastNode } } }];`;

export function createInWorkflowErrorNotify(workflowName: string) {
  const errorTrigger = trigger({
    type: 'n8n-nodes-base.errorTrigger',
    version: 1,
    config: {
      name: 'Error Trigger',
      parameters: {},
    },
    output: [
      {
        workflow: { id: 'unknown', name: workflowName },
        execution: { id: '0', url: '' },
        error: { message: 'Example node failure' },
      },
    ],
  });

  const formatError = node({
    type: 'n8n-nodes-base.code',
    version: 2,
    config: {
      name: 'Format workflow error',
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: FORMAT_WORKFLOW_ERROR_JS,
      },
    },
    output: [
      {
        subject: `n8n-feil: ${workflowName}`,
        text: `Workflow: ${workflowName}`,
        meta: { workflowName },
      },
    ],
  });

  const notifySettings = node({
    type: 'n8n-nodes-base.set',
    version: 3.4,
    config: {
      name: 'Error notify settings',
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
      name: 'Varsle admin om feil',
      onError: 'continueRegularOutput',
      parameters: {
        method: 'POST',
        url: `${FOLKETS_APP_BASE}/api/ops/n8n-notify`,
        sendHeaders: true,
        headerParameters: {
          parameters: [
            {
              name: 'x-cron-secret',
              value: expr("{{ $('Error notify settings').item.json.cronSecret }}"),
            },
          ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: expr(
          '{{ JSON.stringify({ kind: "error", subject: $("Format workflow error").item.json.subject, text: $("Format workflow error").item.json.text, meta: $("Format workflow error").item.json.meta }) }}',
        ),
        options: { timeout: 30000 },
      },
    },
    output: [{ ok: true }],
  });

  sticky(
    '## In-workflow feilvarsling\\n\\nError Trigger kjører ved produksjonsfeil (Ollama/HTTP). POSTer til /api/ops/n8n-notify. Fyll cronSecret i Error notify settings. Live kan fortsatt bruke settings.errorWorkflow; denne kjeden er kilde-fallback. App-kø: /api/cron/n8n-retry (2t).',
    [errorTrigger],
    { color: 1 },
  );

  return { errorTrigger, formatError, notifySettings, notifyAdmin };
}
