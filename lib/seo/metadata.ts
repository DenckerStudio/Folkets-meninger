import type { Metadata } from 'next';

/** Public brand name. Stemme+ is a product tier and keeps its own name. */
export const SITE_NAME = 'Folkets Meninger';

/** Canonical production origin used for `metadataBase`, canonical URLs and OG images. */
export const DEFAULT_SITE_URL = 'https://www.folkets-meninger.no';

export const SITE_LOCALE = 'nb_NO';

export const DEFAULT_DESCRIPTION =
  'En nøytral plattform som brobygger mellom Stortinget og innbyggerne. Les saker, følg høringer og si din mening.';

/** File-based OG image (app/opengraph-image.tsx). */
export const DEFAULT_OG_IMAGE_PATH = '/opengraph-image';

const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/**
 * Resolve the public site origin. `NEXT_PUBLIC_APP_URL` is the canonical app
 * origin already used for Stripe return URLs; `NEXT_PUBLIC_SITE_URL` is kept as
 * a fallback, then the hard-coded production domain.
 */
export function getSiteUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (fromEnv || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

export function getMetadataBase(): URL {
  return new URL(`${getSiteUrl()}/`);
}

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getSiteUrl()}${normalized}`;
}

/** Shorten arbitrary text (e.g. Stortinget titles) to a meta-description length. */
export function truncateDescription(text: string, maxLength = 160): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  const cut = normalized.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

type OgImageSpec = {
  url: string;
  width: number;
  height: number;
  alt: string;
};

export type PageMetadataInput = {
  /** Page title without the brand suffix — the suffix is added automatically. */
  title: string;
  description: string;
  /** Public canonical path, e.g. `/dashboard/utforsk`. */
  canonicalPath: string;
  openGraphType?: 'website' | 'article' | 'profile';
  keywords?: string[];
  /** Absolute or root-relative image paths; defaults to the branded OG image. */
  images?: string[];
  robots?: Metadata['robots'];
  /** Use `title` verbatim instead of appending ` | Folkets Meninger`. */
  absoluteTitle?: boolean;
};

function ogImages(images?: string[]): OgImageSpec[] {
  const paths = images?.length ? images : [DEFAULT_OG_IMAGE_PATH];
  return paths.map((path, index) => ({
    url: path,
    ...OG_IMAGE_SIZE,
    alt: index === 0 ? SITE_NAME : `${SITE_NAME} (${index + 1})`,
  }));
}

/**
 * Build complete page metadata (title, description, canonical, OpenGraph and
 * Twitter). Because Next.js shallow-merges metadata, each page must carry a full
 * `openGraph`/`twitter` object — hence the shared builder.
 */
export function buildPageMetadata({
  title,
  description,
  canonicalPath,
  openGraphType = 'website',
  keywords,
  images,
  robots,
  absoluteTitle = false,
}: PageMetadataInput): Metadata {
  const path = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
  const fullTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;

  return {
    title: fullTitle,
    description,
    ...(keywords?.length ? { keywords } : {}),
    ...(robots ? { robots } : {}),
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      type: openGraphType,
      images: ogImages(images),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: ogImages(images),
    },
  };
}

export function homepageMetadata(): Metadata {
  return buildPageMetadata({
    title: 'Folkets Meninger — din stemme mellom valgene',
    description:
      'Norsk plattform for åpen debatt: les Stortingssaker, følg høringer og si din mening. Uavhengig av Regjeringen og Stortinget.',
    canonicalPath: '/',
    absoluteTitle: true,
  });
}

/** Default metadata for the root layout (applied when a page sets nothing). */
export function defaultSiteMetadata(): Metadata {
  const images = ogImages();
  return {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    openGraph: {
      title: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      type: 'website',
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      images,
    },
  };
}
