import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatBlogDate } from '@/lib/blog/format';
import type { BlogPostListItem } from '@/lib/blog/types';
import { blogPostPath } from '@/lib/blog/urls';

type BlogPostGridProps = {
  posts: BlogPostListItem[];
};

export function BlogPostGrid({ posts }: BlogPostGridProps) {
  if (posts.length === 0) return null;

  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <li key={post.id} data-landing-section>
          <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#00205b]/10 bg-white shadow-sm transition-colors hover:border-[#ba0c2f]/25">
            <div className="relative aspect-[16/9] bg-[#00205b]/5">
              {post.hero_image_url ? (
                <Image
                  src={post.hero_image_url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              ) : null}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <p className="text-xs text-[#001433]/60">
                {post.category_name ?? 'Blogg'} · {formatBlogDate(post.published_at)} ·{' '}
                {post.reading_time_minutes} min
              </p>
              <h2 className="mt-2 text-lg font-bold leading-snug text-[#001433]">
                <Link href={blogPostPath(post.slug)} className="hover:text-[#ba0c2f]">
                  {post.title}
                </Link>
              </h2>
              {post.excerpt ? (
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[#001433]/70">{post.excerpt}</p>
              ) : null}
              {post.tags[0] ? (
                <div className="mt-4">
                  <Badge variant="secondary" className="bg-[#00205b]/5 text-[#00205b]">{post.tags[0]}</Badge>
                </div>
              ) : null}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
