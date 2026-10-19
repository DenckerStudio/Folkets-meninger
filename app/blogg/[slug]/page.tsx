import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BlogArticleBody } from '@/components/blog/blog-article-body';
import { BlogAuthorBox } from '@/components/blog/blog-author-box';
import { BlogCtaBand } from '@/components/blog/blog-cta-band';
import { BlogPostGrid } from '@/components/blog/blog-post-grid';
import { BlogRelatedCards } from '@/components/blog/blog-related-cards';
import { BlogToc } from '@/components/blog/blog-toc';
import { JsonLd } from '@/components/blog/json-ld';
import { ShareButton } from '@/components/share/share-button';
import { Badge } from '@/components/ui/badge';
import { LandingSectionContainer } from '@/components/landing-section-container';
import { LandingHeadingRule } from '@/components/icons/civic';
import { blogArticleJsonLd, blogBreadcrumbJsonLd } from '@/lib/blog/json-ld';
import { formatBlogDate } from '@/lib/blog/format';
import { extractMarkdownHeadings } from '@/lib/blog/markdown-headings';
import {
  loadBlogRelatedHoringCards,
  loadBlogRelatedSakCards,
} from '@/lib/blog/related-context';
import {
  getPublishedBlogPostBySlug,
  listPublishedBlogPostsPaginated,
} from '@/lib/blog/service';
import { blogIndexPath, blogPostOgImagePath, blogPostPath } from '@/lib/blog/urls';
import { absoluteUrl, buildPageMetadata, truncateDescription } from '@/lib/seo/metadata';
import { blogGenerateStaticParams } from '@/lib/blog/route-segment';
import { routes } from '@/lib/routes';

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return blogGenerateStaticParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);
  if (!post) {
    return buildPageMetadata({
      title: 'Artikkel ikke funnet',
      description: 'Denne bloggposten finnes ikke eller er ikke publisert.',
      canonicalPath: blogPostPath(slug),
      robots: { index: false, follow: false },
    });
  }

  return buildPageMetadata({
    title: post.seo_title || post.title,
    description: truncateDescription(post.seo_description || post.excerpt || post.title),
    canonicalPath: blogPostPath(post.slug),
    openGraphType: 'article',
    keywords: post.tags,
    images: [blogPostOgImagePath(post.slug)],
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);
  if (!post) notFound();

  const [saker, horinger, morePosts] = await Promise.all([
    loadBlogRelatedSakCards(post.related_sak_ids),
    loadBlogRelatedHoringCards(post.related_horing_ids),
    listPublishedBlogPostsPaginated({ page: 1, pageSize: 3 }),
  ]);

  const headings = extractMarkdownHeadings(post.body_md);
  const primarySak = post.related_sak_ids[0];
  const canonicalUrl = absoluteUrl(blogPostPath(post.slug));

  return (
    <LandingSectionContainer>
      <JsonLd data={[blogArticleJsonLd(post), blogBreadcrumbJsonLd(post)]} />
      <article className="mx-auto max-w-7xl">
        <nav className="text-sm text-[#001433]/60" data-landing-section aria-label="Brødsmulesti">
          <Link href={blogIndexPath()} className="hover:text-[#ba0c2f]">Blogg</Link>
          {post.category_slug && post.category_name ? (
            <>
              <span className="mx-2" aria-hidden>/</span>
              <Link
                href={`${routes.blogg}/tema/${encodeURIComponent(post.category_slug)}`}
                className="hover:text-[#ba0c2f]"
              >
                {post.category_name}
              </Link>
            </>
          ) : null}
          <span className="mx-2" aria-hidden>/</span>
          <span className="text-[#001433]/80">{post.title}</span>
        </nav>

        <header className="mx-auto mt-6 max-w-3xl" data-landing-section>
          <div className="flex flex-wrap gap-2">
            {post.category_name ? (
              <Badge variant="secondary" className="bg-[#00205b]/5 text-[#00205b]">{post.category_name}</Badge>
            ) : null}
            {post.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="border-[#00205b]/15">{tag}</Badge>
            ))}
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#001433] sm:text-4xl">
            {post.title}
          </h1>
          <LandingHeadingRule />
          {post.excerpt ? (
            <p className="mt-5 text-xl leading-relaxed text-[#001433]/75">{post.excerpt}</p>
          ) : null}
          <p className="mt-4 text-sm text-[#001433]/65">
            {post.author_label} · Publisert {formatBlogDate(post.published_at)}
            {post.updated_at && post.updated_at !== post.published_at
              ? ` · Oppdatert ${formatBlogDate(post.updated_at)}`
              : ''}
            {' · '}
            {post.reading_time_minutes} min
          </p>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start" data-landing-section>
            <BlogToc headings={headings} />
            <ShareButton url={canonicalUrl} title={post.title} className="hidden lg:flex" />
          </aside>

          <div className="min-w-0 space-y-8" data-landing-section>
            <BlogArticleBody markdown={post.body_md} className="prose-lg" />
            <ShareButton url={canonicalUrl} title={post.title} className="lg:hidden" />
            <BlogAuthorBox post={post} />
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start" data-landing-section>
            <BlogRelatedCards saker={saker} horinger={horinger} />
            {primarySak ? (
              <div className="rounded-2xl border border-[#00205b]/10 bg-[#00205b] p-5 text-white shadow-sm">
                <h2 className="text-lg font-semibold">Si din mening</h2>
                <p className="mt-2 text-sm text-white/80">
                  Stem anonymt på saken i appen. Tall vises bare når minst fem stemmer er avgitt.
                </p>
                <Link
                  href={routes.sak(primarySak)}
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-[#ba0c2f] px-4 text-sm font-semibold text-white hover:bg-[#ba0c2f]/90"
                >
                  Åpne saken
                </Link>
              </div>
            ) : null}
          </aside>
        </div>

        <section className="mt-16 border-t border-[#00205b]/10 pt-12" data-landing-section>
          <h2 className="text-2xl font-bold text-[#001433]">Flere innlegg</h2>
          <div className="mt-6">
            <BlogPostGrid
              posts={morePosts.posts.filter((item) => item.slug !== post.slug).slice(0, 3)}
            />
          </div>
        </section>

        <div className="mt-12" data-landing-section>
          <BlogCtaBand />
        </div>
      </article>
    </LandingSectionContainer>
  );
}
