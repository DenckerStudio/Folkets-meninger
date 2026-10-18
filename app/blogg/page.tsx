import Link from 'next/link';
import { BlogPostList } from '@/components/blog/blog-post-list';
import { JsonLd } from '@/components/blog/json-ld';
import { LandingSectionContainer } from '@/components/landing-section-container';
import { LandingHeadingRule } from '@/components/icons/civic';
import { blogIndexBreadcrumbJsonLd } from '@/lib/blog/json-ld';
import { listPublishedBlogPosts } from '@/lib/blog/service';
import { blogRssPath } from '@/lib/blog/urls';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata = buildPageMetadata({
  title: 'Blogg',
  description:
    'Forklaringer og oppdateringer fra Folkets Meninger om Stortinget, høringer og demokratisk deltakelse.',
  canonicalPath: '/blogg',
  keywords: ['Stortinget', 'demokrati', 'høringer', 'Folkets Meninger'],
});

export default async function BloggIndexPage() {
  const posts = await listPublishedBlogPosts(50);

  return (
    <LandingSectionContainer>
      <JsonLd data={blogIndexBreadcrumbJsonLd()} />
      <header className="mx-auto max-w-3xl text-center" data-landing-section>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ba0c2f]">Blogg</p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
          Nytt fra Folkets Meninger
        </h1>
        <LandingHeadingRule className="landing-heading-rule--center" />
        <p className="mt-5 text-lg leading-relaxed text-[#001433]/70">
          Korte artikler om saker, høringer og hvordan du kan delta — uten persondata i teksten.
        </p>
        <p className="mt-4 text-sm text-[#001433]/55">
          <Link href={blogRssPath()} className="font-medium text-[#00205b] hover:text-[#ba0c2f]">
            RSS-feed
          </Link>
        </p>
      </header>

      <div className="mx-auto mt-14 max-w-3xl">
        <BlogPostList posts={posts} />
      </div>
    </LandingSectionContainer>
  );
}
