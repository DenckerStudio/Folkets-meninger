import { isBlogTableMissing } from '@/lib/blog/errors';
import { fireBlogPublishedWebhook } from '@/lib/blog/publish-webhook';
import { isValidBlogSlug, normalizeBlogSlug } from '@/lib/blog/slug';
import type { BlogPostPublic, BlogPostRow, BlogPostStatus } from '@/lib/blog/types';
import { getAnonSupabase } from '@/lib/supabase';
import { getServiceSupabase } from '@/lib/supabase';

const PUBLIC_COLUMNS =
  'slug, title, excerpt, body_md, tags, related_sak_ids, related_horing_ids, published_at';

const ADMIN_COLUMNS =
  'id, slug, title, excerpt, body_md, tags, related_sak_ids, related_horing_ids, status, source_event, created_at, published_at, social_posted_at';

function mapPublicRow(row: Record<string, unknown>): BlogPostPublic {
  return {
    slug: String(row.slug),
    title: String(row.title),
    excerpt: String(row.excerpt ?? ''),
    body_md: String(row.body_md ?? ''),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    related_sak_ids: Array.isArray(row.related_sak_ids) ? row.related_sak_ids.map(String) : [],
    related_horing_ids: Array.isArray(row.related_horing_ids)
      ? row.related_horing_ids.map(String)
      : [],
    published_at: row.published_at ? String(row.published_at) : null,
  };
}

function mapAdminRow(row: Record<string, unknown>): BlogPostRow {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    excerpt: String(row.excerpt ?? ''),
    body_md: String(row.body_md ?? ''),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    related_sak_ids: Array.isArray(row.related_sak_ids) ? row.related_sak_ids.map(String) : [],
    related_horing_ids: Array.isArray(row.related_horing_ids)
      ? row.related_horing_ids.map(String)
      : [],
    status: String(row.status) as BlogPostStatus,
    source_event: row.source_event != null ? String(row.source_event) : null,
    created_at: String(row.created_at),
    published_at: row.published_at ? String(row.published_at) : null,
    social_posted_at: row.social_posted_at ? String(row.social_posted_at) : null,
  };
}

export async function listPublishedBlogPosts(limit = 50): Promise<BlogPostPublic[]> {
  try {
    const supabase = getAnonSupabase();
    const { data, error } = await supabase
      .from('blog_posts')
      .select(PUBLIC_COLUMNS)
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) {
      if (isBlogTableMissing(error)) return [];
      throw error;
    }
    return (data ?? []).map((row) => mapPublicRow(row as Record<string, unknown>));
  } catch (error) {
    if (isBlogTableMissing(error)) return [];
    console.error('[blog] listPublishedBlogPosts failed', error);
    return [];
  }
}

export async function getPublishedBlogPostBySlug(slug: string): Promise<BlogPostPublic | null> {
  try {
    const supabase = getAnonSupabase();
    const { data, error } = await supabase
      .from('blog_posts')
      .select(PUBLIC_COLUMNS)
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();
    if (error) {
      if (isBlogTableMissing(error)) return null;
      throw error;
    }
    if (!data) return null;
    return mapPublicRow(data as Record<string, unknown>);
  } catch (error) {
    if (isBlogTableMissing(error)) return null;
    console.error('[blog] getPublishedBlogPostBySlug failed', error);
    return null;
  }
}

export async function listAdminBlogDrafts(): Promise<BlogPostRow[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('blog_posts')
      .select(ADMIN_COLUMNS)
      .in('status', ['draft', 'approved'])
      .order('created_at', { ascending: false });
    if (error) {
      if (isBlogTableMissing(error)) return [];
      throw error;
    }
    return (data ?? []).map((row) => mapAdminRow(row as Record<string, unknown>));
  } catch (error) {
    if (isBlogTableMissing(error)) return [];
    throw error;
  }
}

export async function getAdminBlogPostById(id: string): Promise<BlogPostRow | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('blog_posts')
    .select(ADMIN_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    if (isBlogTableMissing(error)) return null;
    throw error;
  }
  if (!data) return null;
  return mapAdminRow(data as Record<string, unknown>);
}

export type CreateBlogDraftInput = {
  slug: string;
  title: string;
  excerpt: string;
  body_md: string;
  tags?: string[];
  related_sak_ids?: string[];
  related_horing_ids?: string[];
  source_event?: string | null;
};

export type CreateBlogDraftResult =
  | { ok: true; id: string; slug: string; created: boolean; adminUrl: string }
  | { ok: false; status: number; error: string };

export async function createBlogDraft(
  input: CreateBlogDraftInput,
  adminUrlFor: (id: string) => string,
): Promise<CreateBlogDraftResult> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, status: 503, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' };
  }

  const slug = normalizeBlogSlug(input.slug);
  if (!isValidBlogSlug(slug)) {
    return { ok: false, status: 400, error: 'Ugyldig slug' };
  }

  const title = input.title.trim();
  const excerpt = input.excerpt.trim();
  const body_md = input.body_md.trim();
  if (!title || !body_md) {
    return { ok: false, status: 400, error: 'Tittel og brødtekst er påkrevd' };
  }

  const tags = (input.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 12);
  const related_sak_ids = (input.related_sak_ids ?? []).map((id) => id.trim()).filter(Boolean).slice(0, 8);
  const related_horing_ids = (input.related_horing_ids ?? [])
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 8);
  const source_event = input.source_event?.trim() || null;

  const supabase = getServiceSupabase();

  if (source_event) {
    const { data: existingByEvent } = await supabase
      .from('blog_posts')
      .select('id, slug')
      .eq('source_event', source_event)
      .maybeSingle();
    if (existingByEvent?.id) {
      return {
        ok: true,
        id: String(existingByEvent.id),
        slug: String(existingByEvent.slug),
        created: false,
        adminUrl: adminUrlFor(String(existingByEvent.id)),
      };
    }
  }

  const { data: existingBySlug } = await supabase
    .from('blog_posts')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle();
  if (existingBySlug?.id) {
    return {
      ok: true,
      id: String(existingBySlug.id),
      slug: String(existingBySlug.slug),
      created: false,
      adminUrl: adminUrlFor(String(existingBySlug.id)),
    };
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      slug,
      title,
      excerpt,
      body_md,
      tags,
      related_sak_ids,
      related_horing_ids,
      source_event,
      status: 'draft',
    })
    .select('id, slug')
    .single();

  if (error) {
    if (isBlogTableMissing(error)) {
      return { ok: false, status: 503, error: 'blog_posts-tabellen finnes ikke ennå' };
    }
    console.error('[blog] createBlogDraft insert failed', error);
    return { ok: false, status: 500, error: 'Kunne ikke opprette utkast' };
  }

  const id = String(data.id);
  return {
    ok: true,
    id,
    slug: String(data.slug),
    created: true,
    adminUrl: adminUrlFor(id),
  };
}

export async function updateAdminBlogPost(
  id: string,
  patch: { title?: string; excerpt?: string; body_md?: string },
): Promise<void> {
  const supabase = getServiceSupabase();
  const updates: Record<string, string> = {};
  if (patch.title !== undefined) updates.title = patch.title.trim();
  if (patch.excerpt !== undefined) updates.excerpt = patch.excerpt.trim();
  if (patch.body_md !== undefined) updates.body_md = patch.body_md.trim();
  if (Object.keys(updates).length === 0) return;

  const { error } = await supabase.from('blog_posts').update(updates).eq('id', id);
  if (error) throw error;
}

export async function publishAdminBlogPost(id: string): Promise<BlogPostRow> {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('blog_posts')
    .update({ status: 'published', published_at: now })
    .eq('id', id)
    .in('status', ['draft', 'approved'])
    .select(ADMIN_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('not found');
  const row = mapAdminRow(data as Record<string, unknown>);
  fireBlogPublishedWebhook(row);
  return row;
}

export async function rejectAdminBlogPost(id: string): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from('blog_posts')
    .update({ status: 'rejected' })
    .eq('id', id)
    .in('status', ['draft', 'approved']);
  if (error) throw error;
}

export async function markBlogSocialPosted(slug: string): Promise<boolean> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('blog_posts')
    .update({ social_posted_at: now })
    .eq('slug', slug)
    .eq('status', 'published')
    .select('id')
    .maybeSingle();
  if (error) {
    if (isBlogTableMissing(error)) return false;
    throw error;
  }
  return Boolean(data?.id);
}

export async function listPublishedBlogSlugsForSitemap(limit = 200): Promise<
  { slug: string; published_at: string | null }[]
> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return listPublishedBlogPosts(limit).then((posts) =>
      posts.map((p) => ({ slug: p.slug, published_at: p.published_at })),
    );
  }
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('blog_posts')
      .select('slug, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(limit);
    if (error) {
      if (isBlogTableMissing(error)) return [];
      throw error;
    }
    return (data ?? []).map((row) => ({
      slug: String((row as { slug: string }).slug),
      published_at: (row as { published_at: string | null }).published_at,
    }));
  } catch (error) {
    if (isBlogTableMissing(error)) return [];
    return [];
  }
}
