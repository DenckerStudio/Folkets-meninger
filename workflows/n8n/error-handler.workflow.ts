/**
 * Shared n8n error handler for Folkets Stemme production workflows.
 *
 * Publish this workflow, then set settings.errorWorkflow on AI summary,
 * document embeddings, system poll draft, app cron, and hearing innspill.
 * App-side backup is GET /api/cron/n8n-retry (x-cron-secret).
 */
import { node, sticky, trigger, workflow, expr } from '@n8n/workflow-sdk';

const errorTrigger = trigger({
  type: 'n8n-nodes-base.errorTrigger',
  version: 1,
  config: { name: 'Workflow error' },
  output: [
    {
      workflow: { id: 'unknown', name: 'folkets-workflow' },
      execution: { id: '0', url: '' },
      error: { message: 'Example node failure' },
    },
  ],
});

const recordError = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Record error for retry',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          {
            id: 'workflow-name',
            name: 'workflowName',
            type: 'string',
            value: expr('{{ $json.workflow?.name || "unknown" }}'),
          },
          {
            id: 'execution-id',
            name: 'executionId',
            type: 'string',
            value: expr('{{ $json.execution?.id || "" }}'),
          },
          {
            id: 'message',
            name: 'errorMessage',
            type: 'string',
            value: expr('{{ $json.error?.message || "workflow_failed" }}'),
          },
          {
            id: 'fallback',
            name: 'appFallback',
            type: 'string',
            value: 'GET /api/cron/n8n-retry with x-cron-secret re-queues webhooks; pending DB flags stay',
          },
          {
            id: 'at',
            name: 'failedAt',
            type: 'string',
            value: expr('{{ $now.toISO() }}'),
          },
        ],
      },
    },
  },
  output: [
    {
      workflowName: 'folkets-workflow',
      executionId: '0',
      errorMessage: 'Example node failure',
      appFallback: 'GET /api/cron/n8n-retry',
    },
  ],
});

sticky(
  '## Folkets n8n error handler\\n\\nError Trigger for produksjonsflyter. Publiser denne, sett settings.errorWorkflow på de aktive workflowene. Appen dropper ikke køen: /api/cron/n8n-retry + eksisterende pending-flagg.',
  [errorTrigger],
  { color: 1 },
);

export default workflow(
  'folkets-n8n-error-handler',
  'Folkets Stemme – n8n error handler',
)
  .add(errorTrigger)
  .to(recordError);
