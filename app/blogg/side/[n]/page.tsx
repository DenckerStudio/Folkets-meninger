import { notFound } from 'next/navigation';
import { BlogIndexView } from '@/components/blog/blog-index-view';
import {
  getFeaturedBlogPost,
  listBlogCategories,
  listPublishedBlogPostsPaginated,
} from '@/lib/blog/service';
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

  const [{ posts, totalPages }, categories] = await Promise.all([
    listPublishedBlogPostsPaginated({ page }),
    listBlogCategories(),
  ]);

  if (page > totalPages && totalPages > 0) notFound();

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
