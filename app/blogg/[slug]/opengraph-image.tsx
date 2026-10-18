import { notFound } from 'next/navigation';
import {
  BLOG_OG_CONTENT_TYPE,
  BLOG_OG_SIZE,
  renderBlogPostOgImage,
} from '@/lib/blog/og-image';
import { getPublishedBlogPostBySlug } from '@/lib/blog/service';

export const size = BLOG_OG_SIZE;
export const contentType = BLOG_OG_CONTENT_TYPE;

type ImageProps = {
  params: Promise<{ slug: string }>;
};

export default async function Image({ params }: ImageProps) {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);
  if (!post) notFound();
  return renderBlogPostOgImage(post.title, post.excerpt);
}
