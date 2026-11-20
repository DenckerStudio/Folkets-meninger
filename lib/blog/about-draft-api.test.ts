import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireAdmin } from '@/lib/admin/gate';
import {
  aboutDraftApiDeps,
  handleAboutDraftCreate,
  handleAboutDraftList,
  type AboutDraftApiDeps,
} from '@/lib/blog/about-draft-api';
import type { CreateBlogDraftInput } from '@/lib/blog/service';

const REQUEST_ID = '3f2b8c1a-9d4e-4f6a-8b7c-1e2d3c4b5a69';
const GENERATED_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const ADMIN_URL = 'https://cms.example.test/admin/collections/posts/post-1';

type Calls = {
  lookups: Array<{ slug?: string; sourceEvent?: string }>;
  builds: Array<{ title: string; angle?: string | null; requestId: string; slug: string }>;
  creates: CreateBlogDraftInput[];
  lists: number;
};

function makeDeps(overrides: Partial<AboutDraftApiDeps> = {}): { deps: AboutDraftApiDeps; calls: Calls } {
  const calls: Calls = { lookups: [], builds: [], creates: [], lists: 0 };
  const deps: AboutDraftApiDeps = {
    requireAdmin: async () => ({ ok: true, userId: 'admin-1' }),
    isLlmConfigured: () => true,
    listDrafts: async () => {
      calls.lists += 1;
      return {
        lookupFailed: false,
        drafts: [
          {
            id: 'post-1',
            slug: 'om-oss',
            adminUrl: ADMIN_URL,
            cmsStatus: 'draft',
            sourceEvent: `about:${REQUEST_ID}`,
            updatedAt: '2026-11-20T10:00:00.000Z',
          },
        ],
      };
    },
    lookupPost: async (args) => {
      calls.lookups.push(args);
      return { found: false };
    },
    buildDraftInput: async (args) => {
      calls.builds.push(args);
      return {
        ok: true,
        input: {
          slug: args.slug,
          title: args.title,
          excerpt: 'Ingress',
          body_md: 'Brødtekst',
          category: 'om-folkets-meninger',
          source_event: `about:${args.requestId}`,
        },
      };
    },
    createDraft: async (input) => {
      calls.creates.push(input);
      return {
        ok: true,
        id: 'post-1',
        slug: input.slug,
        created: true,
        adminUrl: ADMIN_URL,
        cmsStatus: 'draft',
      };
    },
    newRequestId: () => GENERATED_ID,
    ...overrides,
  };
  return { deps, calls };
}

function post(body: unknown): Request {
  return new Request('http://localhost/api/admin/blog/about-draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function testGate() {
  for (const denied of [
    { ok: false as const, status: 401, error: 'Du må være logget inn' },
    { ok: false as const, status: 403, error: 'Ingen tilgang' },
  ]) {
    const { deps, calls } = makeDeps({ requireAdmin: async () => denied });

    const created = await handleAboutDraftCreate(post({ title: 'Om oss' }), deps);
    assert.equal(created.status, denied.status);
    assert.deepEqual(created.body, { error: denied.error });

    const listed = await handleAboutDraftList(deps);
    assert.equal(listed.status, denied.status);
    assert.deepEqual(listed.body, { error: denied.error });

    assert.deepEqual(calls, { lookups: [], builds: [], creates: [], lists: 0 });
  }

  const route = readFileSync(
    join(process.cwd(), 'app/api/admin/blog/about-draft/route.ts'),
    'utf-8',
  );
  // The route must call the handlers with their default deps, which carry the real gate.
  assert.match(route, /handleAboutDraftList\(\)/);
  assert.match(route, /handleAboutDraftCreate\(request\)/);
  assert.equal(aboutDraftApiDeps.requireAdmin, requireAdmin);
}

async function testList() {
  const { deps } = makeDeps({ isLlmConfigured: () => false });
  const listed = await handleAboutDraftList(deps);
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body, {
    drafts: [
      {
        id: 'post-1',
        slug: 'om-oss',
        admin_url: ADMIN_URL,
        cms_status: 'draft',
        updated_at: '2026-11-20T10:00:00.000Z',
      },
    ],
    cms_lookup_failed: false,
    llm_configured: false,
  });

  const failing = makeDeps({ listDrafts: async () => ({ drafts: [], lookupFailed: true }) });
  const failed = await handleAboutDraftList(failing.deps);
  assert.equal(failed.status, 200);
  assert.equal(failed.body.cms_lookup_failed, true);
  assert.deepEqual(failed.body.drafts, []);
}

async function testCreate() {
  const { deps, calls } = makeDeps();
  const created = await handleAboutDraftCreate(
    post({ title: ' Om oss ', angle: 'Kort', request_id: REQUEST_ID }),
    deps,
  );
  assert.equal(created.status, 200);
  assert.deepEqual(created.body, {
    ok: true,
    created: true,
    id: 'post-1',
    slug: 'om-oss',
    admin_url: ADMIN_URL,
    cms_status: 'draft',
  });
  assert.deepEqual(calls.lookups, [{ sourceEvent: `about:${REQUEST_ID}` }, { slug: 'om-oss' }]);
  assert.deepEqual(calls.builds, [
    { title: 'Om oss', angle: 'Kort', requestId: REQUEST_ID, slug: 'om-oss' },
  ]);
  assert.equal(calls.creates.length, 1);
  assert.equal(calls.creates[0].category, 'om-folkets-meninger');
  assert.equal(calls.creates[0].source_event, `about:${REQUEST_ID}`);

  const generated = makeDeps();
  await handleAboutDraftCreate(post({ title: 'Om oss' }), generated.deps);
  assert.equal(generated.calls.lookups[0].sourceEvent, `about:${GENERATED_ID}`);
  assert.equal(generated.calls.builds[0].requestId, GENERATED_ID);
  assert.equal(generated.calls.builds[0].angle, null);
}

async function testSlugCollisionGetsOwnSlug() {
  const { deps, calls } = makeDeps({
    lookupPost: async (args) => {
      calls.lookups.push(args);
      if (args.slug === 'om-oss') {
        return { found: true, id: 'other', slug: 'om-oss', adminUrl: ADMIN_URL, cmsStatus: 'published' };
      }
      return { found: false };
    },
  });
  const created = await handleAboutDraftCreate(post({ title: 'Om oss', request_id: REQUEST_ID }), deps);
  assert.equal(created.status, 200);
  assert.equal(created.body.created, true);
  assert.equal(created.body.slug, 'om-oss-3f2b8c1a');
  assert.equal(calls.builds[0].slug, 'om-oss-3f2b8c1a');
}

async function testReplaySkipsGeneration() {
  const { deps, calls } = makeDeps({
    lookupPost: async (args) => {
      calls.lookups.push(args);
      return args.sourceEvent
        ? { found: true, id: 'post-1', slug: 'om-oss', adminUrl: ADMIN_URL, cmsStatus: 'draft' }
        : { found: false };
    },
  });
  const replayed = await handleAboutDraftCreate(post({ title: 'Om oss', request_id: REQUEST_ID }), deps);
  assert.equal(replayed.status, 200);
  assert.deepEqual(replayed.body, {
    ok: true,
    created: false,
    id: 'post-1',
    slug: 'om-oss',
    admin_url: ADMIN_URL,
    cms_status: 'draft',
  });
  assert.equal(calls.builds.length, 0);
  assert.equal(calls.creates.length, 0);
}

async function testErrors() {
  const invalidJson = makeDeps();
  const badJson = await handleAboutDraftCreate(post('{not json'), invalidJson.deps);
  assert.equal(badJson.status, 400);
  assert.equal(badJson.body.error, 'invalid_json');

  const invalidInput = makeDeps();
  const badInput = await handleAboutDraftCreate(post({ title: 'Med MinID' }), invalidInput.deps);
  assert.equal(badInput.status, 400);
  assert.equal(badInput.body.error, 'invalid_input');
  assert.match(String(badInput.body.message), /MinID/);
  assert.equal(invalidInput.calls.lookups.length, 0);

  for (const failAt of ['sourceEvent', 'slug'] as const) {
    const { deps, calls } = makeDeps({
      lookupPost: async (args) => (args[failAt] ? null : { found: false }),
    });
    const down = await handleAboutDraftCreate(post({ title: 'Om oss' }), deps);
    assert.equal(down.status, 503);
    assert.equal(down.body.error, 'cms_unavailable');
    assert.equal(calls.builds.length, 0);
  }

  for (const [code, status] of [
    ['llm_unconfigured', 503],
    ['llm_timeout', 504],
    ['llm_error', 502],
    ['empty_body', 502],
    ['forbidden_terms', 422],
    ['invalid_slug', 400],
  ] as const) {
    const { deps, calls } = makeDeps({
      buildDraftInput: async () => ({ ok: false, code, error: `feil: ${code}` }),
    });
    const failed = await handleAboutDraftCreate(post({ title: 'Om oss' }), deps);
    assert.equal(failed.status, status, code);
    assert.deepEqual(failed.body, { error: code, message: `feil: ${code}` });
    assert.equal(calls.creates.length, 0);
  }

  const cmsError = makeDeps({
    createDraft: async () => ({ ok: false, status: 400, error: 'Ukjent kategori' }),
  });
  const rejected = await handleAboutDraftCreate(post({ title: 'Om oss' }), cmsError.deps);
  assert.equal(rejected.status, 400);
  assert.equal(rejected.body.error, 'cms_error');
  assert.equal(rejected.body.message, 'Ukjent kategori');
}

void (async () => {
  await testGate();
  await testList();
  await testCreate();
  await testSlugCollisionGetsOwnSlug();
  await testReplaySkipsGeneration();
  await testErrors();
  console.log('lib/blog/about-draft-api.test.ts ok');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
