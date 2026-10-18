import { blogPostOgImagePath } from '@/lib/blog/urls';
import { blogIndexPath, blogPostCanonicalUrl, blogPostPath } from '@/lib/blog/urls';
import type { BlogPostPublic } from '@/lib/blog/types';
import { DEFAULT_OG_IMAGE_PATH, SITE_LOCALE, SITE_NAME, absoluteUrl, getSiteUrl } from '@/lib/seo/metadata';

function authorJsonLd(post: BlogPostPublic): Record<string, unknown> {
  const primary = post.authors[0];
  if (!primary) {
    return {
      '@type': 'Organization',
      name: post.author_label,
      url: getSiteUrl(),
    };
  }
  if (primary.kind === 'person') {
    return {
      '@type': 'Person',
      name: primary.name,
      url: `${getSiteUrl()}/blogg/forfatter/${encodeURIComponent(primary.slug)}`,
    };
  }
  return {
    '@type': 'Organization',
    name: primary.name,
    url: `${getSiteUrl()}/blogg/forfatter/${encodeURIComponent(primary.slug)}`,
  };
}

export function blogArticleJsonLd(post: BlogPostPublic): Record<string, unknown> {
  const url = blogPostCanonicalUrl(post.slug);
  const published = post.published_at ?? undefined;
  const modified = post.updated_at ?? post.published_at ?? undefined;
  const image = post.hero_image_url ?? absoluteUrl(blogPostOgImagePath(post.slug));

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    image: [image],
    inLanguage: SITE_LOCALE.replace('_', '-'),
    author: authorJsonLd(post),
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: getSiteUrl(),
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl(DEFAULT_OG_IMAGE_PATH),
      },
    },
    datePublished: published,
    dateModified: modified,
    mainEntityOfPage: url,
    url,
    articleSection: post.category_name ?? undefined,
    keywords: post.tags?.length ? post.tags.join(', ') : undefined,
  };
}

export function blogBreadcrumbJsonLd(post: BlogPostPublic): Record<string, unknown> {
  const base = getSiteUrl();
  const items = [
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
  ];

  if (post.category_slug && post.category_name) {
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: post.category_name,
      item: `${base}/blogg/tema/${encodeURIComponent(post.category_slug)}`,
    });
    items.push({
      '@type': 'ListItem',
      position: 4,
      name: post.title,
      item: blogPostCanonicalUrl(post.slug),
    });
  } else {
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: post.title,
      item: blogPostCanonicalUrl(post.slug),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
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

export function siteOrganizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: getSiteUrl(),
    logo: absoluteUrl(DEFAULT_OG_IMAGE_PATH),
    sameAs: ['https://bsky.app/profile/folkets-meninger.bsky.social'],
  };
}

export function siteWebSiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: getSiteUrl(),
    inLanguage: SITE_LOCALE.replace('_', '-'),
  };
}

export function blogPostPathForMeta(slug: string): string {
  return blogPostPath(slug);
}
