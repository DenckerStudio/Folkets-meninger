import { randomUUID } from 'node:crypto';
import { requireAdmin } from '@/lib/admin/gate';
import {
  aboutBlogSlug,
  aboutBlogSourceEvent,
  buildAboutBlogDraftInput,
  listAboutBlogDrafts,
  parseAboutDraftRequest,
  type AboutBlogDraftErrorCode,
} from '@/lib/blog/about-draft';
import { isAnswerLlmConfigured } from '@/lib/blog/answer-llm';
import { createBlogDraft } from '@/lib/blog/service';
import { cmsBlogOpsLookup, type BlogOpsListedDraft } from '@/lib/cms/blog-ops-client';

export type AboutDraftApiResponse = {
  status: number;
  body: Record<string, unknown>;
};

/** Injected so the gate and the CMS/LLM calls can be exercised without Next request scope. */
export type AboutDraftApiDeps = {
  requireAdmin: typeof requireAdmin;
  isLlmConfigured: typeof isAnswerLlmConfigured;
  listDrafts: typeof listAboutBlogDrafts;
  lookupPost: typeof cmsBlogOpsLookup;
  buildDraftInput: typeof buildAboutBlogDraftInput;
  createDraft: typeof createBlogDraft;
  newRequestId: () => string;
};

export const aboutDraftApiDeps: AboutDraftApiDeps = {
  requireAdmin,
  isLlmConfigured: isAnswerLlmConfigured,
  listDrafts: listAboutBlogDrafts,
  lookupPost: cmsBlogOpsLookup,
  buildDraftInput: buildAboutBlogDraftInput,
  createDraft: createBlogDraft,
  newRequestId: randomUUID,
};

function serializeDraft(row: BlogOpsListedDraft) {
  return {
    id: row.id,
    slug: row.slug,
    admin_url: row.adminUrl,
    cms_status: row.cmsStatus,
    updated_at: row.updatedAt,
  };
}

function buildErrorStatus(code: AboutBlogDraftErrorCode): number {
  switch (code) {
    case 'llm_unconfigured':
      return 503;
    case 'llm_timeout':
      return 504;
    case 'llm_error':
    case 'empty_body':
      return 502;
    case 'forbidden_terms':
      return 422;
    case 'invalid_slug':
      return 400;
    default: {
      const unhandled: never = code;
      throw new Error(`Ukjent feilkode: ${String(unhandled)}`);
    }
  }
}

const CMS_UNAVAILABLE: AboutDraftApiResponse = {
  status: 503,
  body: { error: 'cms_unavailable', message: 'CMS-oppslag feilet. Prøv igjen senere.' },
};

export async function handleAboutDraftList(
  deps: AboutDraftApiDeps = aboutDraftApiDeps,
): Promise<AboutDraftApiResponse> {
  const auth = await deps.requireAdmin();
  if (!auth.ok) {
    return { status: auth.status, body: { error: auth.error } };
  }

  const listed = await deps.listDrafts();
  return {
    status: 200,
    body: {
      drafts: listed.drafts.map(serializeDraft),
      cms_lookup_failed: listed.lookupFailed,
      llm_configured: deps.isLlmConfigured(),
    },
  };
}

export async function handleAboutDraftCreate(
  request: Request,
  deps: AboutDraftApiDeps = aboutDraftApiDeps,
): Promise<AboutDraftApiResponse> {
  const auth = await deps.requireAdmin();
  if (!auth.ok) {
    return { status: auth.status, body: { error: auth.error } };
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { status: 400, body: { error: 'invalid_json', message: 'Ugyldig JSON' } };
  }

  const parsed = parseAboutDraftRequest(json);
  if (!parsed.ok) {
    return { status: 400, body: { error: 'invalid_input', message: parsed.message } };
  }

  const { title, angle } = parsed.value;
  const requestId = parsed.value.requestId ?? deps.newRequestId();

  // Both lookups run before the model so a replayed request or a CMS outage costs no generation.
  const replay = await deps.lookupPost({ sourceEvent: aboutBlogSourceEvent(requestId) });
  if (replay === null) return CMS_UNAVAILABLE;
  if (replay.found) {
    return {
      status: 200,
      body: {
        ok: true,
        created: false,
        id: replay.id,
        slug: replay.slug,
        admin_url: replay.adminUrl,
        cms_status: replay.cmsStatus,
      },
    };
  }

  // createBlogDraft returns an existing post on slug match, so a reused title needs its own slug.
  let slug = aboutBlogSlug(title);
  const slugHit = await deps.lookupPost({ slug });
  if (slugHit === null) return CMS_UNAVAILABLE;
  if (slugHit.found) {
    slug = aboutBlogSlug(title, requestId);
  }

  const built = await deps.buildDraftInput({ title, angle, requestId, slug });
  if (!built.ok) {
    return {
      status: buildErrorStatus(built.code),
      body: { error: built.code, message: built.error },
    };
  }

  const result = await deps.createDraft(built.input);
  if (!result.ok) {
    return {
      status: result.status,
      body: {
        error: 'cms_error',
        message: result.error,
        id: result.id,
        slug: result.slug,
        admin_url: result.adminUrl,
        cms_status: result.cmsStatus,
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      created: result.created,
      id: result.id,
      slug: result.slug,
      admin_url: result.adminUrl,
      cms_status: result.cmsStatus,
    },
  };
}
