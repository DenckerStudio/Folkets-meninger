import assert from 'node:assert/strict';
import { CmsFetchError, getCmsEditorKey, payloadFetch } from '@/lib/cms/payload-client';

const envSnapshot = {
  CMS_URL: process.env.CMS_URL,
  CMS_API_KEY: process.env.CMS_API_KEY,
  CMS_EDITOR_API_KEY: process.env.CMS_EDITOR_API_KEY,
};

function restoreEnv() {
  if (envSnapshot.CMS_URL === undefined) delete process.env.CMS_URL;
  else process.env.CMS_URL = envSnapshot.CMS_URL;
  if (envSnapshot.CMS_API_KEY === undefined) delete process.env.CMS_API_KEY;
  else process.env.CMS_API_KEY = envSnapshot.CMS_API_KEY;
  if (envSnapshot.CMS_EDITOR_API_KEY === undefined) delete process.env.CMS_EDITOR_API_KEY;
  else process.env.CMS_EDITOR_API_KEY = envSnapshot.CMS_EDITOR_API_KEY;
}

void (async () => {
  delete process.env.CMS_URL;
  delete process.env.CMS_API_KEY;

  await assert.rejects(
    () => payloadFetch('/api/posts'),
    (error: unknown) => error instanceof CmsFetchError && error.reason === 'unconfigured',
  );

  process.env.CMS_EDITOR_API_KEY = 'editor-only-key';
  assert.equal(getCmsEditorKey(), 'editor-only-key');
  delete process.env.CMS_EDITOR_API_KEY;
  process.env.CMS_API_KEY = 'reader-key';
  assert.equal(getCmsEditorKey(), null);

  restoreEnv();
  console.log('lib/cms/payload-client.test.ts ok');
})().catch((error) => {
  restoreEnv();
  console.error(error);
  process.exit(1);
});
