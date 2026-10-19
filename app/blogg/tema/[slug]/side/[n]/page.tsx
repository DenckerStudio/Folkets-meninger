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
  params: Promise<{ slug: string; n: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { slug, n } = await params;
  const page = Number.parseInt(n, 10);
  const loaded = await blogCmsOrUnavailable(() =>
    loadBlogIndexPageData({ page, categorySlug: slug }),
  );
  const categories = loaded.unavailable ? [] : loaded.data.categories;
  const category = categories.find((item) => item.slug === slug);
  const base = `${routes.blogg}/tema/${encodeURIComponent(slug)}`;
  return buildPageMetadata({
    title: category ? `Blogg — ${category.name} (side ${page})` : 'Blogg — tema',
    description: category?.description || 'Artikler fra Folkets Meninger.',
    canonicalPath: `${base}/side/${page}`,
  });
}

export default async function BloggTemaPageNumber({ params }: PageProps) {
  const { slug, n } = await params;
  const page = Number.parseInt(n, 10);
  if (!Number.isFinite(page) || page < 2) notFound();

  const loaded = await blogCmsOrUnavailable(() =>
    loadBlogIndexPageData({ page, categorySlug: slug }),
  );
  if (loaded.unavailable) return <BlogCmsUnavailable />;

  const { posts, totalPages, categories } = loaded.data;
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();
  if (isBlogPageOutOfRange(page, totalPages)) notFound();

  const basePath = `${routes.blogg}/tema/${encodeURIComponent(slug)}`;

  return (
    <BlogIndexView
      title={category.name}
      intro={category.description || 'Artikler i dette temaet fra Folkets Meninger.'}
      categories={categories}
      activeCategorySlug={slug}
      featured={null}
      posts={posts}
      page={page}
      totalPages={totalPages}
      paginationBasePath={basePath}
    />
  );
}
