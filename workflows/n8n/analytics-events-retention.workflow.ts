/**
 * Weekly purge of first-party analytics_events older than 365 days.
 *
 * Draft only — do **not** import or activate until Mathias explicitly approves
 * running retention. Kept separate from HTTP aggregate ingestion so that
 * workflow can go live without scheduling deletion.
 *
 * RPC: purge_analytics_events_older_than (service_role), migration
 * `20261122120000_analytics_events_retention.sql`.
 */
import { newCredential, node, sticky, trigger, workflow } from '@n8n/workflow-sdk';
import { FOLKETS_SUPABASE_CRED, rpcUrl } from './n8n-supabase.shared';
import { createInWorkflowErrorNotify } from './in-workflow-error-notify';

const retentionSchedule = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Weekly analytics retention',
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '0 4 * * 1' }] },
    },
  },
  output: [{}],
});

const purgeAnalyticsEvents = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Purge analytics_events > 365d',
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'POST',
      url: rpcUrl('purge_analytics_events_older_than'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '{"p_days":365}',
      options: { timeout: 120000 },
    },
  },
  output: [],
});

const inWorkflowError = createInWorkflowErrorNotify('folkets-analytics-events-retention');

sticky(
  '## Analytics events retention\n\n**Do not publish** until Mathias approves scheduled deletion.\nApply migration `20261122120000` first. Default retention: 365 days.',
  [retentionSchedule],
  { color: 1 },
);

export default workflow(
  'folkets-analytics-events-retention',
  'Folkets Meninger – analytics events retention',
)
  .add(retentionSchedule)
  .to(purgeAnalyticsEvents)
  .add(inWorkflowError.errorTrigger)
  .to(inWorkflowError.formatError.to(inWorkflowError.notifySettings).to(inWorkflowError.notifyAdmin));
