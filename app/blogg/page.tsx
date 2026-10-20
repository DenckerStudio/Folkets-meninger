import { BlogCmsUnavailableShell } from '@/components/blog/blog-cms-unavailable-shell';
import { BlogIndexView } from '@/components/blog/blog-index-view';
import { blogCmsOrUnavailable } from '@/lib/blog/cms-read-runtime';
import { loadBlogIndexPageData } from '@/lib/blog/index-page-loaders';
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
  const loaded = await blogCmsOrUnavailable(() => loadBlogIndexPageData({ page: 1 }));
  if (loaded.unavailable) return <BlogCmsUnavailableShell />;

  const { posts, totalPages, categories, featured } = loaded.data;

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
