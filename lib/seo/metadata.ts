import type { Metadata } from 'next';

export const SITE_NAME = 'Folkets Stemme';

/** Canonical production origin for metadata (og:url, rel=canonical). */
export const DEFAULT_SITE_URL = 'https://www.folkets-stemme.no';

export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (fromEnv || DEFAULT_SITE_URL).replace(/\/$/, '');
}

export function getMetadataBase(): URL {
  return new URL(`${getSiteUrl()}/`);
}

type PublicPageMetadataInput = {
  /** Segment merged with `| Folkets Stemme` via the dashboard title template. */
  titleSegment: string;
  description: string;
  /** Public short URL path, e.g. `/avstemninger`. */
  canonicalPath: string;
};

export function publicPageMetadata({
  titleSegment,
  description,
  canonicalPath,
}: PublicPageMetadataInput): Metadata {
  const path = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
  const fullTitle = `${titleSegment} | ${SITE_NAME}`;

  return {
    title: titleSegment,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: 'nb_NO',
      type: 'website',
    },
  };
}

export function homepageMetadata(): Metadata {
  const title = 'Folkets Stemme — stem mellom valgene';
  const description =
    'Si din mening om Stortingssaker med Ja, Nei eller Blank. Anonymt. Uavhengig av Regjeringen og Stortinget.';

  return {
    title,
    description,
    alternates: {
      canonical: '/',
    },
    openGraph: {
      title,
      description,
      url: '/',
      siteName: SITE_NAME,
      locale: 'nb_NO',
      type: 'website',
    },
  };
}
