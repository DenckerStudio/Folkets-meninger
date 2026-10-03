import {
  workflow,
  node,
  trigger,
  sticky,
  newCredential,
  languageModel,
  splitInBatches,
  nextBatch,
  expr,
  ifElse,
} from '@n8n/workflow-sdk';
import { FOLKETS_N8N_BASE, FOLKETS_SUPABASE_CRED, rpcUrl } from './n8n-supabase.shared';
import {
  BUILD_SAK_CONTEXT_JS,
  EXPAND_OR_EMPTY_JS,
  MAP_SUMMARY_OUTPUT_JS,
  SUMMARY_SYSTEM_MESSAGE,
} from './n8n-pipeline.shared';

const ollamaChatModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Ollama Chat Model',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'qwen3:4b-q4_K_M',
      options: {
        think: false,
        temperature: 0.2,
        format: 'json',
        numPredict: 2200,
        numCtx: 16384,
      },
    },
  },
});

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Every 30 minutes',
    parameters: {
      rule: {
        interval: [{ field: 'minutes', minutesInterval: 30 }],
      },
    },
  },
  output: [{}],
});

const backfillSettingsSchedule = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Backfill settings (schedule)',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'batch-limit', name: 'batchLimit', value: '1', type: 'string' },
        ],
      },
    },
  },
  output: [{ batchLimit: '1' }],
});

const fetchMissingSummaries = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Fetch issues without summary',
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'POST',
      url: rpcUrl('n8n_list_issues_missing_ai_summary'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '={{ JSON.stringify({ p_limit: Number($("Backfill settings (schedule)").item.json.batchLimit || 1) }) }}',
      ),
      options: { timeout: 60000 },
    },
  },
  output: [
    {
      id: '200329',
      title: 'Example sak',
      summary: 'Kort tittel',
      ai_summary_source_context: 'Innstillingstekst',
    },
  ],
});

const expandMissingIssues = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Expand missing issues',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: EXPAND_OR_EMPTY_JS,
    },
  },
  output: [{ id: '200329', title: 'Example sak' }],
});

const processOneIssue = splitInBatches({
  version: 3,
  config: {
    name: 'Process one issue',
    parameters: { batchSize: 1 },
  },
});

const buildSakContext = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build sak context',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: BUILD_SAK_CONTEXT_JS,
    },
  },
  output: [
    {
      id: '200329',
      title: 'Example sak',
      sakContextText: 'Sak ID: 200329\nTittel: Example',
      contextChars: 32,
    },
  ],
});

const hasUsableContext = ifElse({
  version: 2.2,
  config: {
    name: 'Has usable context?',
    parameters: {
      looseTypeValidation: true,
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'has-id',
            leftValue: expr('{{ $json.id }}'),
            rightValue: '',
            operator: { type: 'string', operation: 'notEmpty' },
          },
          {
            id: 'enough-context',
            leftValue: expr('{{ $json.contextChars }}'),
            rightValue: 40,
            operator: { type: 'number', operation: 'gt' },
          },
        ],
      },
    },
  },
});

const generateSummaryAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Generate summary (Ollama)',
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.sakContextText }}'),
      hasOutputParser: false,
      options: {
        systemMessage: SUMMARY_SYSTEM_MESSAGE,
        maxIterations: 4,
        enableStreaming: false,
      },
      subnodes: {
        model: ollamaChatModel,
      },
    },
  },
  output: [{ output: { hva: 'Sakens innhold', hvem: 'Berørte', kostnad: 'Ikke omtalt' } }],
});

const mapAgentOutput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Map agent output',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: MAP_SUMMARY_OUTPUT_JS,
    },
  },
  output: [
    {
      issueId: '200329',
      hva: 'Sakens innhold',
      hvem: 'Berørte grupper',
      kostnad: 'Ikke omtalt i kilden.',
      narrative: 'Sakens innhold',
      who_affected: 'Berørte grupper',
      how_affected: '',
      topic_cards: [],
      labels: ['Skatt'],
    },
  ],
});

const hasValidSummary = ifElse({
  version: 2.2,
  config: {
    name: 'Has valid summary?',
    parameters: {
      looseTypeValidation: true,
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'has-issue',
            leftValue: expr('{{ $json.issueId }}'),
            rightValue: '',
            operator: { type: 'string', operation: 'notEmpty' },
          },
          {
            id: 'not-skip',
            leftValue: expr('{{ $json.skip }}'),
            rightValue: true,
            operator: { type: 'boolean', operation: 'notEquals' },
          },
        ],
      },
    },
  },
});

const saveSummaryToDb = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Save summary to Supabase',
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'POST',
      url: rpcUrl('n8n_upsert_issue_ai_summary'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '={{ JSON.stringify({ p_issue_id: $json.issueId, p_hva: $json.hva, p_hvem: $json.hvem, p_kostnad: $json.kostnad, p_narrative: $json.narrative || $json.hva, p_who_affected: $json.who_affected || $json.hvem, p_how_affected: $json.how_affected || "", p_topic_cards: $json.topic_cards || [], p_labels: $json.labels || [] }) }}',
      ),
      options: { timeout: 60000 },
    },
  },
  output: [{ ok: true }],
});

const triggerPollDraft = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Trigger system poll draft',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: `${FOLKETS_N8N_BASE}/webhook/folkets-system-poll-draft`,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '={{ JSON.stringify({ stortinget_issue_id: $("Map agent output").item.json.issueId }) }}',
      ),
      options: { timeout: 15000 },
    },
  },
  output: [{ ok: true }],
});

const logSummaryResult = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Log summary result',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          {
            id: 'issue-id',
            name: 'issueId',
            value: expr('{{ $("Map agent output").item.json.issueId }}'),
            type: 'string',
          },
          { id: 'saved', name: 'saved', value: true, type: 'boolean' },
          { id: 'outcome', name: 'outcome', value: 'saved', type: 'string' },
        ],
      },
    },
  },
  output: [{ issueId: '200329', saved: true, outcome: 'saved' }],
});

const logSkipSummary = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Log skipped summary',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'outcome', name: 'outcome', value: 'skipped', type: 'string' },
          {
            id: 'message',
            name: 'message',
            value: 'Skipped AI summary (empty queue, thin context, or invalid model output)',
            type: 'string',
          },
        ],
      },
    },
  },
  output: [{ outcome: 'skipped' }],
});

const rateLimitPause = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: {
    name: 'Rate limit pause',
    parameters: {
      resume: 'timeInterval',
      amount: 5,
      unit: 'seconds',
    },
  },
});

const batchRunComplete = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Batch run complete',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'status', name: 'status', value: 'scheduled_backfill_complete', type: 'string' },
          { id: 'at', name: 'completedAt', value: expr('{{ $now.toISO() }}'), type: 'string' },
        ],
      },
    },
  },
  output: [{ status: 'scheduled_backfill_complete' }],
});

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook new issue',
    parameters: {
      httpMethod: 'POST',
      path: 'folkets-ai-summary',
      responseMode: 'responseNode',
    },
  },
  output: [{ body: { stortinget_issue_id: '200329' } }],
});

const normalizeIssueId = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Normalize issue ID',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          {
            id: 'issue-id',
            name: 'id',
            value: expr(
              '{{ $json.body?.stortinget_issue_id ?? $json.body?.id ?? $json.stortinget_issue_id ?? $json.id }}',
            ),
            type: 'string',
          },
        ],
      },
    },
  },
  output: [{ id: '200329' }],
});

const hasWebhookIssueId = ifElse({
  version: 2.2,
  config: {
    name: 'Has webhook issue id?',
    parameters: {
      looseTypeValidation: true,
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'has-id',
            leftValue: expr('{{ $json.id }}'),
            rightValue: '',
            operator: { type: 'string', operation: 'notEmpty' },
          },
        ],
      },
    },
  },
});

const fetchIssueContext = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Fetch issue context',
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'POST',
      url: rpcUrl('n8n_get_issue_ai_summary_context'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '={{ JSON.stringify({ p_issue_id: $("Normalize issue ID").item.json.id }) }}',
      ),
      options: { timeout: 60000 },
    },
  },
  output: [
    {
      id: '200329',
      title: 'Example sak',
      summary: 'Kort',
      ai_summary_source_context: 'Kontekst',
    },
  ],
});

const expandWebhookIssue = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Expand webhook issue',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: EXPAND_OR_EMPTY_JS,
    },
  },
  output: [{ id: '200329', title: 'Example sak' }],
});

const buildSakContextWebhook = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build sak context (webhook)',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: BUILD_SAK_CONTEXT_JS,
    },
  },
  output: [{ id: '200329', sakContextText: 'Sak ID: 200329', contextChars: 18 }],
});

const hasWebhookContext = ifElse({
  version: 2.2,
  config: {
    name: 'Has webhook context?',
    parameters: {
      looseTypeValidation: true,
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'has-id',
            leftValue: expr('{{ $json.id }}'),
            rightValue: '',
            operator: { type: 'string', operation: 'notEmpty' },
          },
          {
            id: 'enough-context',
            leftValue: expr('{{ $json.contextChars }}'),
            rightValue: 40,
            operator: { type: 'number', operation: 'gt' },
          },
        ],
      },
    },
  },
});

const generateSummaryAgentWebhook = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Generate summary (Ollama webhook)',
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.sakContextText }}'),
      hasOutputParser: false,
      options: {
        systemMessage: SUMMARY_SYSTEM_MESSAGE,
        maxIterations: 4,
        enableStreaming: false,
      },
      subnodes: {
        model: ollamaChatModel,
      },
    },
  },
  output: [{ output: { hva: 'Sakens innhold', hvem: 'Berørte', kostnad: 'Ikke omtalt' } }],
});

const mapAgentOutputWebhook = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Map agent output (webhook)',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: MAP_SUMMARY_OUTPUT_JS,
    },
  },
  output: [
    {
      issueId: '200329',
      hva: 'Sakens innhold',
      hvem: 'Berørte grupper',
      kostnad: 'Ikke omtalt i kilden.',
      narrative: 'Sakens innhold',
      who_affected: 'Berørte grupper',
      how_affected: '',
      topic_cards: [],
      labels: ['Skatt'],
    },
  ],
});

const hasValidWebhookSummary = ifElse({
  version: 2.2,
  config: {
    name: 'Has valid webhook summary?',
    parameters: {
      looseTypeValidation: true,
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'has-issue',
            leftValue: expr('{{ $json.issueId }}'),
            rightValue: '',
            operator: { type: 'string', operation: 'notEmpty' },
          },
          {
            id: 'not-skip',
            leftValue: expr('{{ $json.skip }}'),
            rightValue: true,
            operator: { type: 'boolean', operation: 'notEquals' },
          },
        ],
      },
    },
  },
});

const saveSummaryWebhook = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Save summary (webhook)',
    credentials: { supabaseApi: newCredential(FOLKETS_SUPABASE_CRED) },
    parameters: {
      method: 'POST',
      url: rpcUrl('n8n_upsert_issue_ai_summary'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '={{ JSON.stringify({ p_issue_id: $json.issueId, p_hva: $json.hva, p_hvem: $json.hvem, p_kostnad: $json.kostnad, p_narrative: $json.narrative || $json.hva, p_who_affected: $json.who_affected || $json.hvem, p_how_affected: $json.how_affected || "", p_topic_cards: $json.topic_cards || [], p_labels: $json.labels || [] }) }}',
      ),
      options: { timeout: 60000 },
    },
  },
  output: [{ ok: true }],
});

const triggerPollDraftWebhook = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Trigger system poll draft (webhook)',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: `${FOLKETS_N8N_BASE}/webhook/folkets-system-poll-draft`,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        '={{ JSON.stringify({ stortinget_issue_id: $("Map agent output (webhook)").item.json.issueId }) }}',
      ),
      options: { timeout: 15000 },
    },
  },
  output: [{ ok: true }],
});

const respondToWebhook = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond to Webhook',
    parameters: {
      respondWith: 'json',
      responseBody: expr(
        '{{ { ok: true, issueId: $("Map agent output (webhook)").item.json.issueId, saved: true, hva: $("Map agent output (webhook)").item.json.hva } }}',
      ),
    },
  },
});

const respondWebhookSkipped = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond skipped',
    parameters: {
      respondWith: 'json',
      responseBody: expr(
        '{{ { ok: true, skipped: true, reason: $json.reason || "missing_or_thin_issue" } }}',
      ),
    },
  },
});

sticky(
  '## AI-sammendrag (Ollama)\n\nTom kø avbrytes uten Ollama-kall. Webhook henter `n8n_get_issue_ai_summary_context`. Etter lagring trigges system-poll-utkast.\n\n**Ikke** generer sammendrag uten sak-id.',
  [scheduleTrigger, webhookTrigger],
  { color: 4 },
);

const savedSchedulePath = saveSummaryToDb
  .to(triggerPollDraft)
  .to(logSummaryResult)
  .to(rateLimitPause)
  .to(nextBatch(processOneIssue));

const summaryPipeline = buildSakContext.to(
  hasUsableContext
    .onTrue(
      generateSummaryAgent.to(
        mapAgentOutput.to(hasValidSummary.onTrue(savedSchedulePath).onFalse(logSkipSummary.to(nextBatch(processOneIssue)))),
      ),
    )
    .onFalse(logSkipSummary.to(nextBatch(processOneIssue))),
);

const webhookSavedPath = saveSummaryWebhook.to(triggerPollDraftWebhook).to(respondToWebhook);

export default workflow(
  'folkets-ai-summary-backfill',
  'Folkets Stemme – AI-sammendrag backfill',
)
  .add(scheduleTrigger)
  .to(backfillSettingsSchedule)
  .to(fetchMissingSummaries)
  .to(expandMissingIssues)
  .to(processOneIssue.onDone(batchRunComplete).onEachBatch(summaryPipeline))
  .add(webhookTrigger)
  .to(normalizeIssueId)
  .to(
    hasWebhookIssueId
      .onTrue(
        fetchIssueContext.to(expandWebhookIssue).to(buildSakContextWebhook).to(
          hasWebhookContext
            .onTrue(
              generateSummaryAgentWebhook.to(
                mapAgentOutputWebhook.to(
                  hasValidWebhookSummary.onTrue(webhookSavedPath).onFalse(respondWebhookSkipped),
                ),
              ),
            )
            .onFalse(respondWebhookSkipped),
        ),
      )
      .onFalse(respondWebhookSkipped),
  )
  .group('Hent manglende saker', [backfillSettingsSchedule, fetchMissingSummaries, expandMissingIssues], {
    description: 'RPC-kø for saker uten AI-sammendrag',
  });
