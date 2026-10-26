import {
  getFeaturedBlogPost,
  listBlogCategories,
  listPublishedBlogPostsPaginated,
} from '@/lib/blog/service';

export async function loadBlogIndexPageData(args: {
  page: number;
  categorySlug?: string | null;
}) {
  const categorySlug = args.categorySlug ?? null;
  const [{ posts, totalPages }, categories, featured] = await Promise.all([
    listPublishedBlogPostsPaginated({ page: args.page, categorySlug }),
    listBlogCategories(),
    args.page === 1 && !categorySlug ? getFeaturedBlogPost() : Promise.resolve(null),
  ]);
  return { posts, totalPages, categories, featured };
}
