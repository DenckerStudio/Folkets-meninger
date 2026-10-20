import Link from 'next/link';
import { BlogCategoryChips } from '@/components/blog/blog-category-chips';
import { BlogCtaBand } from '@/components/blog/blog-cta-band';
import { BlogFeaturedHero } from '@/components/blog/blog-featured-hero';
import { BlogPaginationLinks } from '@/components/blog/blog-pagination-links';
import { BlogPostGrid } from '@/components/blog/blog-post-grid';
import { JsonLd } from '@/components/blog/json-ld';
import { LandingSectionContainer } from '@/components/landing-section-container';
import { LandingHeadingRule } from '@/components/icons/civic';
import { blogIndexBreadcrumbJsonLd } from '@/lib/blog/json-ld';
import type { BlogCategory, BlogPostListItem, BlogPostPublic } from '@/lib/blog/types';
import { blogRssPath } from '@/lib/blog/urls';
import { routes } from '@/lib/routes';

type BlogIndexViewProps = {
  title: string;
  intro: string;
  categories: BlogCategory[];
  activeCategorySlug?: string | null;
  featured: BlogPostPublic | null;
  posts: BlogPostListItem[];
  page: number;
  totalPages: number;
  paginationBasePath?: string;
};

export function BlogIndexView({
  title,
  intro,
  categories,
  activeCategorySlug,
  featured,
  posts,
  page,
  totalPages,
  paginationBasePath = routes.blogg,
}: BlogIndexViewProps) {
  const gridPosts =
    featured && page === 1 && !activeCategorySlug
      ? posts.filter((post) => post.slug !== featured.slug)
      : posts;

  return (
    <LandingSectionContainer>
      <JsonLd data={blogIndexBreadcrumbJsonLd()} />
      <header className="mx-auto max-w-3xl text-center" data-landing-section>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ba0c2f]">Blogg</p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">{title}</h1>
        <LandingHeadingRule className="landing-heading-rule--center" />
        <p className="mt-5 text-lg leading-relaxed text-[#001433]/70">{intro}</p>
        <p className="mt-4 text-sm text-[#001433]/60">
          <Link href={blogRssPath()} className="font-medium text-[#00205b] hover:text-[#ba0c2f]">
            RSS-feed
          </Link>
        </p>
      </header>

      <div className="mx-auto mt-10 max-w-6xl space-y-8">
        <BlogCategoryChips categories={categories} activeSlug={activeCategorySlug} />
        {featured && page === 1 && !activeCategorySlug ? (
          <BlogFeaturedHero post={featured} />
        ) : null}

        {gridPosts.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed border-[#00205b]/15 bg-white/80 px-6 py-14 text-center shadow-sm"
            data-landing-section
          >
            <p className="text-lg font-semibold text-[#001433]">Ingen artikler ennå</p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#001433]/65">
              Vi publiserer forklaringer her når de er godkjent i redaksjonen. Følg med via RSS-feeden
              under overskriften.
            </p>
          </div>
        ) : (
          <BlogPostGrid posts={gridPosts} />
        )}

        <BlogPaginationLinks currentPage={page} totalPages={totalPages} basePath={paginationBasePath} />
        <BlogCtaBand />
      </div>
    </LandingSectionContainer>
  );
}
