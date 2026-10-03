/**
 * Folkets Stemme – App cron (n8n schedule → HTTP)
 *
 * Erstatter Vercel Cron (krever Pro). n8n kaller appens /api/cron/* med x-cron-secret.
 *
 * Sett appBaseUrl og cronSecret i hver «Cron settings*»-node i n8n (ikke commit hemmeligheter).
 * In-workflow Error Trigger → POST /api/ops/n8n-notify (kilde-fallback).
 */
import { workflow, node, trigger, sticky } from '@n8n/workflow-sdk';
import { createInWorkflowErrorNotify } from './in-workflow-error-notify';

const CALL_CRON_JS = `const SETTINGS_NODES = [
  'Cron settings',
  'Cron settings (categories)',
  'Cron settings (labels)',
  'Cron settings (digest daily)',
  'Cron settings (digest weekly)',
  'Cron settings (package counter proposals)',
  'Cron settings (n8n retry)',
];
let settings = {};
for (const name of SETTINGS_NODES) {
  try {
    const row = $(name).first()?.json;
    if (row?.appBaseUrl && row?.cronSecret) {
      settings = row;
      break;
    }
  } catch (_) {}
}
const baseUrl = String(settings.appBaseUrl || '').replace(/\\\\/$/, '');
const secret = String(settings.cronSecret || '').trim();
const path = $json.cronPath || '/api/cron/sync-issues';
const query = $json.cronQuery ? '?' + $json.cronQuery : '';

if (!baseUrl || !secret) {
  throw new Error('Missing appBaseUrl or cronSecret in Cron settings');
}

let lastError = null;
for (let attempt = 1; attempt <= 2; attempt++) {
  try {
    const res = await this.helpers.httpRequest({
      method: 'GET',
      url: baseUrl + path + query,
      headers: { 'x-cron-secret': secret },
      timeout: 300000,
      json: true,
    });
    return [{ json: { ok: true, path, response: res, attempt } }];
  } catch (e) {
    lastError = e;
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
  }
}
const status = lastError.statusCode || lastError.response?.statusCode;
const body = lastError.response?.body || lastError.message;
throw new Error('App cron ' + path + ' failed (status ' + (status || 'n/a') + '): ' + (typeof body === 'string' ? body : JSON.stringify(body)));
`;

function cronSettingsNode(name: string) {
  return node({
    type: 'n8n-nodes-base.set',
    version: 3.4,
    config: {
      name,
      parameters: {
        mode: 'manual',
        assignments: {
          assignments: [
            {
              id: 'app-base-url',
              name: 'appBaseUrl',
              value: 'https://www.folkets-stemme.no',
              type: 'string',
            },
            {
              id: 'cron-secret',
              name: 'cronSecret',
              value: '',
              type: 'string',
            },
          ],
        },
      },
    },
    output: [{ appBaseUrl: 'https://www.folkets-stemme.no', cronSecret: '' }],
  });
}

const cronSettingsSync = cronSettingsNode('Cron settings');
const cronSettingsCategories = cronSettingsNode('Cron settings (categories)');
const cronSettingsLabels = cronSettingsNode('Cron settings (labels)');
const cronSettingsDigestDaily = cronSettingsNode('Cron settings (digest daily)');
const cronSettingsDigestWeekly = cronSettingsNode('Cron settings (digest weekly)');
const cronSettingsPackageCounter = cronSettingsNode('Cron settings (package counter proposals)');
const cronSettingsN8nRetry = cronSettingsNode('Cron settings (n8n retry)');

const setSyncPath = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Path: sync-issues',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'p', name: 'cronPath', value: '/api/cron/sync-issues', type: 'string' },
        ],
      },
    },
  },
  output: [{ cronPath: '/api/cron/sync-issues' }],
});

const setCategoriesPath = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Path: categories',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'p', name: 'cronPath', value: '/api/cron/categories', type: 'string' },
        ],
      },
    },
  },
  output: [{ cronPath: '/api/cron/categories' }],
});

const setLabelsPath = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Path: labels',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'p', name: 'cronPath', value: '/api/cron/labels', type: 'string' },
        ],
      },
    },
  },
  output: [{ cronPath: '/api/cron/labels' }],
});

const setDigestDailyPath = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Path: digest daily',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'p', name: 'cronPath', value: '/api/cron/digest', type: 'string' },
          { id: 'q', name: 'cronQuery', value: 'frequency=daily', type: 'string' },
        ],
      },
    },
  },
  output: [{ cronPath: '/api/cron/digest', cronQuery: 'frequency=daily' }],
});

const setPackageCounterPath = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Path: package-counter-proposals',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'p', name: 'cronPath', value: '/api/cron/package-counter-proposals', type: 'string' },
        ],
      },
    },
  },
  output: [{ cronPath: '/api/cron/package-counter-proposals' }],
});

const setN8nRetryPath = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Path: n8n-retry',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'p', name: 'cronPath', value: '/api/cron/n8n-retry', type: 'string' },
        ],
      },
    },
  },
  output: [{ cronPath: '/api/cron/n8n-retry' }],
});

const setDigestWeeklyPath = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Path: digest weekly',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'p', name: 'cronPath', value: '/api/cron/digest', type: 'string' },
          { id: 'q', name: 'cronQuery', value: 'frequency=weekly', type: 'string' },
        ],
      },
    },
  },
  output: [{ cronPath: '/api/cron/digest', cronQuery: 'frequency=weekly' }],
});

const callCron = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Call app cron',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: CALL_CRON_JS,
    },
  },
  output: [{ ok: true, path: '/api/cron/sync-issues', response: { ok: true } }],
});

const scheduleSyncIssues = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Daily 03:00 sync-issues',
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '0 3 * * *' }] },
    },
  },
  output: [{}],
});

const scheduleCategories = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Daily 04:00 categories',
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '0 4 * * *' }] },
    },
  },
  output: [{}],
});

const scheduleLabels = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Daily 04:30 labels',
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '30 4 * * *' }] },
    },
  },
  output: [{}],
});

const scheduleDigestDaily = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Daily 07:00 digest',
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '0 7 * * *' }] },
    },
  },
  output: [{}],
});

const schedulePackageCounter = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Daily 06:00 package-counter-proposals',
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '0 6 * * *' }] },
    },
  },
  output: [{}],
});

const scheduleN8nRetry = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Every 2 hours n8n-retry',
    parameters: {
      rule: { interval: [{ field: 'hours', hoursInterval: 2 }] },
    },
  },
  output: [{}],
});

const scheduleDigestWeekly = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Mon 07:30 digest weekly',
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '30 7 * * 1' }] },
    },
  },
  output: [{}],
});

const inWorkflowError = createInWorkflowErrorNotify('folkets-app-cron');

sticky(
  '## App cron (n8n → Folkets Stemme)\\n\\nErstatter Vercel Cron. Fyll inn **cronSecret** (samme som CRON_SECRET i app) og **appBaseUrl** i hver Cron settings-node. Error Trigger POSTer til /api/ops/n8n-notify. n8n-retry kjører hver 2. time.',
  [scheduleSyncIssues, scheduleCategories, scheduleLabels, schedulePackageCounter, scheduleN8nRetry, scheduleDigestDaily, scheduleDigestWeekly],
  { color: 3 }
);

export default workflow('folkets-app-cron', 'Folkets Stemme – App cron (n8n)')
  .add(scheduleSyncIssues)
  .to(cronSettingsSync.to(setSyncPath).to(callCron))
  .add(scheduleCategories)
  .to(cronSettingsCategories.to(setCategoriesPath).to(callCron))
  .add(scheduleLabels)
  .to(cronSettingsLabels.to(setLabelsPath).to(callCron))
  .add(scheduleDigestDaily)
  .to(cronSettingsDigestDaily.to(setDigestDailyPath).to(callCron))
  .add(schedulePackageCounter)
  .to(cronSettingsPackageCounter.to(setPackageCounterPath).to(callCron))
  .add(scheduleN8nRetry)
  .to(cronSettingsN8nRetry.to(setN8nRetryPath).to(callCron))
  .add(scheduleDigestWeekly)
  .to(cronSettingsDigestWeekly.to(setDigestWeeklyPath).to(callCron))
  .add(inWorkflowError.errorTrigger)
  .to(inWorkflowError.formatError.to(inWorkflowError.notifySettings).to(inWorkflowError.notifyAdmin));
