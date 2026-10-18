import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BlogMarkdown } from '@/components/blog/blog-markdown';
import { BlogRelatedCards } from '@/components/blog/blog-related-cards';
import { JsonLd } from '@/components/blog/json-ld';
import { Badge } from '@/components/ui/badge';
import { LandingSectionContainer } from '@/components/landing-section-container';
import { LandingHeadingRule } from '@/components/icons/civic';
import { blogArticleJsonLd, blogBreadcrumbJsonLd } from '@/lib/blog/json-ld';
import { formatBlogDate } from '@/lib/blog/format';
import {
  loadBlogRelatedHoringCards,
  loadBlogRelatedSakCards,
} from '@/lib/blog/related-context';
import { getPublishedBlogPostBySlug } from '@/lib/blog/service';
import { BLOG_AUTHOR_LABEL } from '@/lib/blog/types';
import { blogIndexPath, blogPostOgImagePath, blogPostPath } from '@/lib/blog/urls';
import { buildPageMetadata, truncateDescription } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ slug: string }>;
};

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
    title: post.title,
    description: truncateDescription(post.excerpt || post.title),
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

  const [saker, horinger] = await Promise.all([
    loadBlogRelatedSakCards(post.related_sak_ids),
    loadBlogRelatedHoringCards(post.related_horing_ids),
  ]);

  return (
    <LandingSectionContainer>
      <JsonLd data={[blogArticleJsonLd(post), blogBreadcrumbJsonLd(post)]} />
      <article className="mx-auto max-w-3xl">
        <nav className="text-sm text-[#001433]/55" data-landing-section aria-label="Brødsmulesti">
          <Link href={blogIndexPath()} className="hover:text-[#ba0c2f]">Blogg</Link>
          <span className="mx-2" aria-hidden>/</span>
          <span className="text-[#001433]/75">{post.title}</span>
        </nav>

        <header className="mt-6" data-landing-section>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[#001433]/55">
            <time dateTime={post.published_at ?? undefined}>{formatBlogDate(post.published_at)}</time>
            <span aria-hidden>·</span>
            <span>{BLOG_AUTHOR_LABEL}</span>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#001433] sm:text-4xl">
            {post.title}
          </h1>
          <LandingHeadingRule />
          {post.excerpt ? (
            <p className="mt-5 text-xl leading-relaxed text-[#001433]/75">{post.excerpt}</p>
          ) : null}
          {post.tags.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="bg-[#00205b]/5 text-[#00205b]">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </header>

        <div className="mt-10" data-landing-section>
          <BlogMarkdown markdown={post.body_md} />
        </div>

        <div className="mt-14 border-t border-[#00205b]/10 pt-10" data-landing-section>
          <BlogRelatedCards saker={saker} horinger={horinger} />
        </div>

        <p className="mt-12 text-center text-sm text-[#001433]/55" data-landing-section>
          <Link href={blogIndexPath()} className="font-medium text-[#00205b] hover:text-[#ba0c2f]">
            ← Tilbake til bloggen
          </Link>
        </p>
      </article>
    </LandingSectionContainer>
  );
}
