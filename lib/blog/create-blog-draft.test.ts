import assert from 'node:assert/strict';
import { createBlogDraft } from '@/lib/blog/service';

const envSnapshot = {
  CMS_URL: process.env.CMS_URL,
  CMS_API_KEY: process.env.CMS_API_KEY,
  CMS_AGENT_API_KEY: process.env.CMS_AGENT_API_KEY,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(envSnapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

void (async () => {
  process.env.CMS_URL = 'https://cms.example.test';
  delete process.env.CMS_API_KEY;
  delete process.env.CMS_AGENT_API_KEY;

  const missingKey = await createBlogDraft({
    slug: 'test-slug',
    title: 'T',
    excerpt: 'E',
    body_md: 'body',
  });
  assert.equal(missingKey.ok, false);
  if (!missingKey.ok) {
    assert.equal(missingKey.status, 503);
    assert.match(missingKey.error, /CMS_API_KEY/);
  }

  restoreEnv();
  console.log('lib/blog/create-blog-draft.test.ts ok');
})().catch((error) => {
  restoreEnv();
  console.error(error);
  process.exit(1);
});
