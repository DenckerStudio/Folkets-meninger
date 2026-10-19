import { BlogIndexView } from '@/components/blog/blog-index-view';
import {
  getFeaturedBlogPost,
  listBlogCategories,
  listPublishedBlogPostsPaginated,
} from '@/lib/blog/service';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export const metadata = buildPageMetadata({
  title: 'Blogg',
  description:
    'Forklaringer og oppdateringer fra Folkets Meninger om Stortinget, høringer og demokratisk deltakelse.',
  canonicalPath: '/blogg',
  keywords: ['Stortinget', 'demokrati', 'høringer', 'Folkets Meninger'],
});

export default async function BloggIndexPage() {
  const [{ posts, totalPages }, categories, featured] = await Promise.all([
    listPublishedBlogPostsPaginated({ page: 1 }),
    listBlogCategories(),
    getFeaturedBlogPost(),
  ]);

  return (
    <BlogIndexView
      title="Forklart: Stortinget, høringer og din stemme"
      intro="Korte artikler om saker, høringer og hvordan du kan delta — uten persondata i teksten."
      categories={categories}
      featured={featured}
      posts={posts}
      page={1}
      totalPages={totalPages}
    />
  );
}
