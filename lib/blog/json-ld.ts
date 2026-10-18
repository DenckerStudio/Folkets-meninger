import { BLOG_AUTHOR_LABEL } from '@/lib/blog/types';
import { blogIndexPath, blogPostCanonicalUrl, blogPostPath } from '@/lib/blog/urls';
import { SITE_NAME, getSiteUrl } from '@/lib/seo/metadata';
import type { BlogPostPublic } from '@/lib/blog/types';

export function blogArticleJsonLd(post: BlogPostPublic): Record<string, unknown> {
  const url = blogPostCanonicalUrl(post.slug);
  const published = post.published_at ?? undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    author: {
      '@type': 'Organization',
      name: BLOG_AUTHOR_LABEL,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: getSiteUrl(),
    },
    datePublished: published,
    dateModified: published,
    mainEntityOfPage: url,
    url,
    keywords: post.tags?.length ? post.tags.join(', ') : undefined,
  };
}

export function blogBreadcrumbJsonLd(post: BlogPostPublic): Record<string, unknown> {
  const base = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Forside',
        item: `${base}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blogg',
        item: `${base}${blogIndexPath()}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.title,
        item: blogPostCanonicalUrl(post.slug),
      },
    ],
  };
}

export function blogIndexBreadcrumbJsonLd(): Record<string, unknown> {
  const base = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Forside',
        item: `${base}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blogg',
        item: `${base}${blogIndexPath()}`,
      },
    ],
  };
}

export function blogPostPathForMeta(slug: string): string {
  return blogPostPath(slug);
}
