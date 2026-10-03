/**
 * Daily pipeline health: catch up missed webhooks and notify when queues stall.
 */
import { expr, ifElse, newCredential, node, sticky, trigger, workflow } from '@n8n/workflow-sdk';
import {
  FOLKETS_APP_BASE,
  FOLKETS_N8N_BASE,
  FOLKETS_SUPABASE_CRED,
  rpcUrl,
} from './n8n-supabase.shared';

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Daily 08:00 health',
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '0 8 * * *' }] },
    },
  },
  output: [{}],
});

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook pipeline health',
    parameters: {
      httpMethod: 'POST',
      path: 'folkets-pipeline-health',
      responseMode: 'onReceived',
    },
  },
  output: [{}],
});

const fetchPendingChunks = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Count pending chunks',
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'POST',
      url: rpcUrl('n8n_list_pending_document_chunks'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '{"p_issue_id":null,"p_limit":50}',
      options: { timeout: 60000 },
    },
  },
  output: [],
});

const fetchMissingSummaries = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Count missing summaries',
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'POST',
      url: rpcUrl('n8n_list_issues_missing_ai_summary'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '{"p_limit":20}',
      options: { timeout: 60000 },
    },
  },
  output: [],
});

const fetchDraftPolls = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'List draft polls',
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'GET',
      url: 'https://supabase.heyklever.app/rest/v1/polls?track=eq.system&status=eq.draft&select=id,title,stortinget_issue_id,created_at&order=created_at.desc&limit=20',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      options: { timeout: 60000 },
    },
  },
  output: [],
});

const summarizeHealth = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Summarize health',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `function asRows(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (raw && typeof raw === 'object' && (raw.id || raw.issue_id)) return [raw];
  return [];
}
const chunks = asRows($('Count pending chunks').first()?.json);
const missing = asRows($('Count missing summaries').first()?.json).filter((r) => r && r.id);
const drafts = asRows($('List draft polls').first()?.json).filter((r) => r && r.id);
const pendingChunks = chunks.filter((r) => r && r.id).length;
const missingSummaries = missing.length;
const draftPolls = drafts.length;
const firstMissingId = String(missing[0]?.id || '').trim();
const needsCatchup = pendingChunks > 0;
const needsSummaryCatchup = Boolean(firstMissingId);
const needsAlert = pendingChunks >= 40 || missingSummaries >= 15 || draftPolls >= 8;
const subject = 'Pipeline-status: ' + pendingChunks + ' chunks, ' + missingSummaries + ' sammendrag, ' + draftPolls + ' utkast';
const text = [
  'Folkets Stemme n8n-pipeline',
  '',
  'Pending embeddings: ' + pendingChunks,
  'Saker uten AI-sammendrag: ' + missingSummaries,
  'System-poll utkast som venter: ' + draftPolls,
  '',
  draftPolls ? ('Publiser utkast: https://www.folkets-stemme.no/dashboard/admin/reels') : null,
].filter(Boolean).join('\\n');
return [{
  json: {
    pendingChunks,
    missingSummaries,
    draftPolls,
    firstMissingId,
    needsCatchup,
    needsSummaryCatchup,
    needsAlert,
    subject,
    text,
  },
}];`,
    },
  },
  output: [
    {
      pendingChunks: 0,
      missingSummaries: 0,
      draftPolls: 0,
      firstMissingId: '',
      needsCatchup: false,
      needsSummaryCatchup: false,
      needsAlert: false,
    },
  ],
});

const needsCatchup = ifElse({
  version: 2.2,
  config: {
    name: 'Needs embedding catch-up?',
    parameters: {
      looseTypeValidation: true,
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'catchup',
            leftValue: expr('{{ $json.needsCatchup }}'),
            rightValue: true,
            operator: { type: 'boolean', operation: 'equals' },
          },
        ],
      },
    },
  },
});

const triggerEmbeddings = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Catch-up embeddings',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: `${FOLKETS_N8N_BASE}/webhook/folkets-document-embeddings`,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '{}',
      options: { timeout: 15000 },
    },
  },
  output: [{ ok: true }],
});

const needsSummaryCatchup = ifElse({
  version: 2.2,
  config: {
    name: 'Needs summary catch-up?',
    parameters: {
      looseTypeValidation: true,
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'summary-catchup',
            leftValue: expr("{{ $('Summarize health').item.json.needsSummaryCatchup }}"),
            rightValue: true,
            operator: { type: 'boolean', operation: 'equals' },
          },
        ],
      },
    },
  },
});

const triggerSummaries = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Catch-up AI summaries',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: `${FOLKETS_N8N_BASE}/webhook/folkets-ai-summary`,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '={{ JSON.stringify({ stortinget_issue_id: $("Summarize health").item.json.firstMissingId }) }}',
      ),
      options: { timeout: 15000 },
    },
  },
  output: [{ ok: true }],
});

const needsAlert = ifElse({
  version: 2.2,
  config: {
    name: 'Needs admin alert?',
    parameters: {
      looseTypeValidation: true,
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'alert',
            leftValue: expr("{{ $('Summarize health').item.json.needsAlert }}"),
            rightValue: true,
            operator: { type: 'boolean', operation: 'equals' },
          },
        ],
      },
    },
  },
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
        '={{ JSON.stringify({ kind: "health", subject: $("Summarize health").item.json.subject, text: $("Summarize health").item.json.text, meta: { pendingChunks: $("Summarize health").item.json.pendingChunks, missingSummaries: $("Summarize health").item.json.missingSummaries, draftPolls: $("Summarize health").item.json.draftPolls } }) }}',
      ),
      options: { timeout: 30000 },
    },
  },
  output: [{ ok: true }],
});

const logHealthy = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Log healthy',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'outcome', name: 'outcome', value: 'healthy', type: 'string' },
        ],
      },
    },
  },
  output: [{ outcome: 'healthy' }],
});

sticky(
  '## Pipeline-helse\n\nDaglig 08:00 + webhook. Catch-up av embeddings og varsel ved stor kø. Fyll inn cronSecret.',
  [scheduleTrigger, webhookTrigger],
  { color: 3 },
);

const alertPath = needsAlert.onTrue(notifyAdmin).onFalse(logHealthy);
const summaryCatchupPath = needsSummaryCatchup.onTrue(triggerSummaries.to(alertPath)).onFalse(alertPath);

const healthBody = fetchPendingChunks
  .to(fetchMissingSummaries)
  .to(fetchDraftPolls)
  .to(summarizeHealth)
  .to(notifySettings)
  .to(needsCatchup.onTrue(triggerEmbeddings.to(summaryCatchupPath)).onFalse(summaryCatchupPath));

export default workflow(
  'folkets-pipeline-health',
  'Folkets Stemme – pipeline-helse',
)
  .add(scheduleTrigger)
  .to(healthBody)
  .add(webhookTrigger)
  .to(healthBody);
