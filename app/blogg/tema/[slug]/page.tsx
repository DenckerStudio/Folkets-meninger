import { notFound } from 'next/navigation';
import { BlogIndexView } from '@/components/blog/blog-index-view';
import { listBlogCategories, listPublishedBlogPostsPaginated } from '@/lib/blog/service';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const categories = await listBlogCategories();
  const category = categories.find((item) => item.slug === slug);
  return buildPageMetadata({
    title: category ? `Blogg — ${category.name}` : 'Blogg — tema',
    description: category?.description || 'Artikler fra Folkets Meninger.',
    canonicalPath: `/blogg/tema/${encodeURIComponent(slug)}`,
  });
}

export default async function BloggTemaPage({ params }: PageProps) {
  const { slug } = await params;
  const categories = await listBlogCategories();
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();

  const { posts, totalPages } = await listPublishedBlogPostsPaginated({
    page: 1,
    categorySlug: slug,
  });

  return (
    <BlogIndexView
      title={category.name}
      intro={category.description || 'Artikler i dette temaet fra Folkets Meninger.'}
      categories={categories}
      activeCategorySlug={slug}
      featured={null}
      posts={posts}
      page={1}
      totalPages={totalPages}
      paginationBasePath={`/blogg/tema/${encodeURIComponent(slug)}`}
    />
  );
}
