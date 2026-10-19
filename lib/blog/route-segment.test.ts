import assert from 'node:assert/strict';
import { blogGenerateStaticParams } from '@/lib/blog/route-segment';

const envSnapshot = {
  CMS_URL: process.env.CMS_URL,
  CMS_API_KEY: process.env.CMS_API_KEY,
};

function restoreEnv() {
  if (envSnapshot.CMS_URL === undefined) delete process.env.CMS_URL;
  else process.env.CMS_URL = envSnapshot.CMS_URL;
  if (envSnapshot.CMS_API_KEY === undefined) delete process.env.CMS_API_KEY;
  else process.env.CMS_API_KEY = envSnapshot.CMS_API_KEY;
}

void (async () => {
  delete process.env.CMS_URL;
  delete process.env.CMS_API_KEY;

  const params = await blogGenerateStaticParams();
  assert.deepEqual(params, []);

  restoreEnv();
  console.log('lib/blog/route-segment.test.ts ok');
})().catch((error) => {
  restoreEnv();
  console.error(error);
  process.exit(1);
});
