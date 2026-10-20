import { notFound } from 'next/navigation';
import {
  BLOG_OG_CONTENT_TYPE,
  BLOG_OG_SIZE,
  renderBlogCmsUnavailableOgImage,
  renderBlogPostOgImage,
} from '@/lib/blog/og-image';
import { blogCmsOrUnavailable } from '@/lib/blog/cms-read-runtime';
import { getPublishedBlogPostBySlug } from '@/lib/blog/service';

export const size = BLOG_OG_SIZE;
export const contentType = BLOG_OG_CONTENT_TYPE;

type ImageProps = {
  params: Promise<{ slug: string }>;
};

export default async function Image({ params }: ImageProps) {
  const { slug } = await params;
  const loaded = await blogCmsOrUnavailable(async () => {
    const post = await getPublishedBlogPostBySlug(slug);
    if (!post) return null;
    return post;
  });
  if (loaded.unavailable) {
    return renderBlogCmsUnavailableOgImage();
  }
  if (!loaded.data) notFound();
  return renderBlogPostOgImage(loaded.data.title, loaded.data.excerpt);
}
