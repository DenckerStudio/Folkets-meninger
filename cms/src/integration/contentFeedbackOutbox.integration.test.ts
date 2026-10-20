import assert from 'node:assert/strict';
import { createLocalReq, getPayload, type Payload } from 'payload';
import config from '@/payload.config';
import { seedTaxonomy } from '@/seed/seedBaseData';

const databaseUri = process.env.DATABASE_URI?.trim();
const runIntegration = process.env.CMS_INTEGRATION_TESTS === '1' && Boolean(databaseUri);

async function countContentFeedbackJobs(payload: Payload): Promise<number> {
  const result = await payload.find({
    collection: 'payload-jobs',
    where: {
      taskSlug: {
        equals: 'contentFeedbackSend',
      },
    },
    limit: 0,
    pagination: false,
    overrideAccess: true,
  });
  return result.totalDocs;
}

async function getFirstCategoryId(payload: Payload): Promise<string | number> {
  const categories = await payload.find({
    collection: 'categories',
    limit: 1,
    overrideAccess: true,
  });
  const id = categories.docs[0]?.id;
  assert.ok(id != null, 'forventer seed-kategori');
  return id;
}

async function main() {
  if (!runIntegration) {
    console.log(
      'cms integration/contentFeedbackOutbox: skipped (set CMS_INTEGRATION_TESTS=1 and DATABASE_URI)',
    );
    return;
  }

  process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET || 'ci-test-secret';

  const payload = await getPayload({ config });
  await seedTaxonomy(payload);
  const categoryId = await getFirstCategoryId(payload);
  const slug = `cf-outbox-${Date.now()}`;

  const created = await payload.create({
    collection: 'posts',
    data: {
      title: 'Outbox test',
      slug,
      excerpt: 'Ingress for outbox-test.',
      bodyMarkdown: '# Test',
      category: categoryId,
      origin: 'n8n',
      _status: 'draft',
    },
    overrideAccess: true,
  });

  const postId = created.id;
  assert.ok(postId != null);

  const jobsBeforeFlips = await countContentFeedbackJobs(payload);
  let status: 'published' | 'draft' = 'draft';

  for (let i = 0; i < 30; i += 1) {
    status = status === 'draft' ? 'published' : 'draft';
    await payload.update({
      collection: 'posts',
      id: postId,
      data: { _status: status },
      overrideAccess: true,
    });
  }

  const jobsAfterFlips = await countContentFeedbackJobs(payload);
  assert.equal(jobsAfterFlips - jobsBeforeFlips, 30);

  const tx = await payload.db.beginTransaction();
  assert.ok(tx, 'forventer database-transaksjon');
  const req = await createLocalReq({ req: { transactionID: tx } }, payload);
  const jobsBeforeTx = await countContentFeedbackJobs(payload);

  await payload.update({
    collection: 'posts',
    id: postId,
    data: { _status: status === 'published' ? 'draft' : 'published' },
    overrideAccess: true,
    req,
  });

  const jobsInTx = await countContentFeedbackJobs(payload);
  assert.equal(jobsInTx, jobsBeforeTx + 1);

  await payload.db.rollbackTransaction(tx);
  const jobsAfterRollback = await countContentFeedbackJobs(payload);
  assert.equal(jobsAfterRollback, jobsBeforeTx);

  await payload.update({
    collection: 'posts',
    id: postId,
    data: { origin: 'manual' },
    overrideAccess: true,
  });

  const main = await payload.findByID({
    collection: 'posts',
    id: postId,
    draft: false,
    depth: 0,
    overrideAccess: true,
  });
  assert.equal(main.origin, 'n8n');

  await payload.delete({
    collection: 'posts',
    id: postId,
    overrideAccess: true,
  });

  console.log('cms integration/contentFeedbackOutbox.integration.test.ts ok');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
