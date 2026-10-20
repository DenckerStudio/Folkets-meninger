import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { getPayload, type Payload } from 'payload';
import config from '@/payload.config';
import type { ContentFeedbackSendInput } from '@/jobs/contentFeedbackSend';
import { CONTENT_FEEDBACK_OPS_PATH } from '@/lib/contentFeedbackHmac';

const databaseUri = process.env.DATABASE_URI?.trim();
const runIntegration = process.env.CMS_INTEGRATION_TESTS === '1' && Boolean(databaseUri);

function sampleInput(): ContentFeedbackSendInput {
  return {
    postId: '99',
    event: 'published',
    eventId: '11111111-2222-4333-8444-555555555555',
    occurredAt: new Date().toISOString(),
    snapshot: {
      slug: 'retry-test',
      title: 'Retry test',
      excerpt: 'Ingress.',
      categories: ['Forklart'],
      origin: 'n8n',
    },
  };
}

async function startMockServer(
  handler: (hit: number) => { status: number; body?: string },
): Promise<{ server: Server; url: string; getHits: () => number }> {
  let hits = 0;
  const server = createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end();
      return;
    }
    hits += 1;
    const { status, body } = handler(hits);
    res.writeHead(status);
    res.end(body ?? '');
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}${CONTENT_FEEDBACK_OPS_PATH}`;
  return { server, url, getHits: () => hits };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function queueJob(payload: Payload): Promise<string | number> {
  const job = await payload.jobs.queue({
    task: 'contentFeedbackSend',
    input: sampleInput(),
    queue: 'content-feedback',
    overrideAccess: true,
  });
  assert.ok(job.id != null);
  return job.id;
}

async function findJob(payload: Payload, id: string | number) {
  return payload.findByID({
    collection: 'payload-jobs',
    id,
    overrideAccess: true,
  });
}

async function runQueueOnce(payload: Payload): Promise<void> {
  await payload.jobs.run({
    queue: 'content-feedback',
    limit: 1,
    overrideAccess: true,
  });
}

async function waitForJobIdle(payload: Payload, id: string | number): Promise<Awaited<ReturnType<typeof findJob>>> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const job = await findJob(payload, id);
    if (!job.processing) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return findJob(payload, id);
}

async function main() {
  if (!runIntegration) {
    console.log(
      'cms integration/contentFeedbackSendJob: skipped (set CMS_INTEGRATION_TESTS=1 and DATABASE_URI)',
    );
    return;
  }

  process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET || 'ci-test-secret';
  process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET = 'integration-test-secret';
  process.env.FM_WEB_URL = 'http://127.0.0.1';

  const payload = await getPayload({ config });

  const retryMock = await startMockServer((hit) =>
    hit === 1 ? { status: 500, body: 'fail' } : { status: 200, body: 'ok' },
  );
  process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_URL = retryMock.url;

  const retryJobId = await queueJob(payload);
  await runQueueOnce(payload);
  let retryJob = await waitForJobIdle(payload, retryJobId);
  assert.equal(retryMock.getHits(), 1);
  assert.equal(retryJob.hasError, false);

  await payload.update({
    collection: 'payload-jobs',
    id: retryJobId,
    data: { waitUntil: null, processing: false },
    overrideAccess: true,
  });

  await runQueueOnce(payload);
  assert.equal(retryMock.getHits(), 2);
  const afterRetry = await findJob(payload, retryJobId).catch(() => null);
  assert.ok(
    afterRetry === null || (afterRetry.completedAt != null && afterRetry.hasError === false),
    'retry should complete successfully (job deleted or marked complete)',
  );
  await closeServer(retryMock.server);

  const clientMock = await startMockServer(() => ({ status: 400, body: 'bad' }));
  process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_URL = clientMock.url;

  const clientJobId = await queueJob(payload);
  await runQueueOnce(payload);
  const clientJob = await waitForJobIdle(payload, clientJobId);
  assert.equal(clientMock.getHits(), 1);
  assert.equal(clientJob.hasError, true);
  await closeServer(clientMock.server);

  delete process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET;
  delete process.env.REVALIDATE_SECRET;
  const configJobId = await queueJob(payload);
  await runQueueOnce(payload);
  const configJob = await waitForJobIdle(payload, configJobId);
  assert.equal(configJob.hasError, true);
  assert.ok(configJob.id != null);

  process.env.CMS_CONTENT_FEEDBACK_WEBHOOK_SECRET = 'integration-test-secret';

  console.log('cms integration/contentFeedbackSendJob.integration.test.ts ok');
  process.exit(0);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
