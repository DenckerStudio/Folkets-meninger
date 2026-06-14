/**
 * Folkets Stemme – App cron (n8n schedule → HTTP)
 *
 * Erstatter Vercel Cron (krever Pro). n8n kaller appens /api/cron/* med x-cron-secret.
 *
 * Sett appBaseUrl og cronSecret i hver «Cron settings*»-node i n8n (ikke commit hemmeligheter).
 */
import { workflow, node, trigger, sticky } from '@n8n/workflow-sdk';

const CALL_CRON_JS = `const SETTINGS_NODES = [
  'Cron settings',
  'Cron settings (categories)',
  'Cron settings (digest daily)',
  'Cron settings (digest weekly)',
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
  return [{ json: { ok: false, error: 'Missing appBaseUrl or cronSecret in Cron settings' } }];
}

try {
  const res = await this.helpers.httpRequest({
    method: 'GET',
    url: baseUrl + path + query,
    headers: { 'x-cron-secret': secret },
    timeout: 300000,
    json: true,
  });
  return [{ json: { ok: true, path, response: res } }];
} catch (e) {
  const status = e.statusCode || e.response?.statusCode;
  const body = e.response?.body || e.message;
  return [{ json: { ok: false, path, status, error: body } }];
}`;

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
const cronSettingsDigestDaily = cronSettingsNode('Cron settings (digest daily)');
const cronSettingsDigestWeekly = cronSettingsNode('Cron settings (digest weekly)');

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

sticky(
  '## App cron (n8n → Folkets Stemme)\\n\\nErstatter Vercel Cron. Fyll inn **cronSecret** (samme som CRON_SECRET i app) og **appBaseUrl** i hver Cron settings-node.',
  [scheduleSyncIssues, scheduleCategories, scheduleDigestDaily, scheduleDigestWeekly],
  { color: 3 }
);

export default workflow('folkets-app-cron', 'Folkets Stemme – App cron (n8n)')
  .add(scheduleSyncIssues)
  .to(cronSettingsSync.to(setSyncPath).to(callCron))
  .add(scheduleCategories)
  .to(cronSettingsCategories.to(setCategoriesPath).to(callCron))
  .add(scheduleDigestDaily)
  .to(cronSettingsDigestDaily.to(setDigestDailyPath).to(callCron))
  .add(scheduleDigestWeekly)
  .to(cronSettingsDigestWeekly.to(setDigestWeeklyPath).to(callCron));
