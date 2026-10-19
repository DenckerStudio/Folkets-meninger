import { notFound } from 'next/navigation';
import { BlogCmsUnavailable } from '@/components/blog/blog-cms-unavailable';
import { BlogIndexView } from '@/components/blog/blog-index-view';
import { blogCmsOrUnavailable } from '@/lib/blog/cms-read-runtime';
import { loadBlogIndexPageData } from '@/lib/blog/index-page-loaders';
import { isBlogPageOutOfRange } from '@/lib/blog/pagination';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { routes } from '@/lib/routes';

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ n: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { n } = await params;
  const page = Number.parseInt(n, 10);
  return buildPageMetadata({
    title: `Blogg — side ${page}`,
    description: 'Artikler fra Folkets Meninger.',
    canonicalPath: `${routes.blogg}/side/${page}`,
  });
}

export default async function BloggPageNumber({ params }: PageProps) {
  const { n } = await params;
  const page = Number.parseInt(n, 10);
  if (!Number.isFinite(page) || page < 2) notFound();

  const loaded = await blogCmsOrUnavailable(() => loadBlogIndexPageData({ page }));
  if (loaded.unavailable) return <BlogCmsUnavailable />;

  const { posts, totalPages, categories } = loaded.data;
  if (isBlogPageOutOfRange(page, totalPages)) notFound();

  return (
    <BlogIndexView
      title="Forklart: Stortinget, høringer og din stemme"
      intro="Korte artikler om saker, høringer og hvordan du kan delta — uten persondata i teksten."
      categories={categories}
      featured={null}
      posts={posts}
      page={page}
      totalPages={totalPages}
    />
  );
}
