import { notFound } from 'next/navigation';
import { BlogIndexView } from '@/components/blog/blog-index-view';
import { listBlogCategories, listPublishedBlogPostsPaginated } from '@/lib/blog/service';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { routes } from '@/lib/routes';

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ slug: string; n: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { slug, n } = await params;
  const page = Number.parseInt(n, 10);
  const categories = await listBlogCategories();
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

  const categories = await listBlogCategories();
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();

  const { posts, totalPages } = await listPublishedBlogPostsPaginated({
    page,
    categorySlug: slug,
  });

  if (page > totalPages && totalPages > 0) notFound();

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
