import assert from 'node:assert/strict';
import { CmsFetchError } from '@/lib/cms/cms-fetch-error';
import { blogCmsOrUnavailable, swallowBlogCmsErrorAtBuild } from '@/lib/blog/cms-read-runtime';
import { isNextProductionBuildPhase } from '@/lib/cms/next-build-phase';

const phaseSnapshot = process.env.NEXT_PHASE;

function restorePhase() {
  if (phaseSnapshot === undefined) delete process.env.NEXT_PHASE;
  else process.env.NEXT_PHASE = phaseSnapshot;
}

void (async () => {
  delete process.env.NEXT_PHASE;
  assert.equal(isNextProductionBuildPhase(), false);

  const runtimeSoft = await blogCmsOrUnavailable(async () => {
    throw new CmsFetchError('nettverk', 'network');
  });
  assert.deepEqual(runtimeSoft, { unavailable: true });

  await assert.rejects(
    () =>
      blogCmsOrUnavailable(async () => {
        throw new Error('kartleggingsfeil');
      }),
    /kartleggingsfeil/,
  );

  process.env.NEXT_PHASE = 'phase-production-build';
  assert.equal(isNextProductionBuildPhase(), true);

  const soft = await blogCmsOrUnavailable(async () => {
    throw new CmsFetchError('http', 'http');
  });
  assert.deepEqual(soft, { unavailable: true });

  const ok = await blogCmsOrUnavailable(async () => ({ posts: [] }));
  assert.deepEqual(ok, { unavailable: false, data: { posts: [] } });

  assert.equal(swallowBlogCmsErrorAtBuild(new CmsFetchError('x', 'http')), true);
  assert.equal(swallowBlogCmsErrorAtBuild(new Error('annet')), false);

  restorePhase();
  console.log('lib/blog/cms-read-runtime.test.ts ok');
})().catch((error) => {
  restorePhase();
  console.error(error);
  process.exit(1);
});
