import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatBlogDate } from '@/lib/blog/format';
import type { BlogPostPublic } from '@/lib/blog/types';
import { blogPostPath } from '@/lib/blog/urls';

type BlogFeaturedHeroProps = {
  post: BlogPostPublic;
};

export function BlogFeaturedHero({ post }: BlogFeaturedHeroProps) {
  return (
    <article
      className="grid overflow-hidden rounded-3xl border border-[#00205b]/10 bg-white shadow-sm lg:grid-cols-2"
      data-landing-section
    >
      <div className="relative aspect-[16/10] bg-[#00205b]/5 lg:aspect-auto lg:min-h-[320px]">
        {post.hero_image_url ? (
          <Image
            src={post.hero_image_url}
            alt=""
            fill
            priority
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        ) : (
          <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-[#001433]/50">
            Utvalgt innlegg
          </div>
        )}
      </div>
      <div className="flex flex-col justify-center gap-4 p-6 sm:p-8">
        <div className="flex flex-wrap gap-2">
          {post.category_name ? (
            <Badge variant="secondary" className="bg-[#00205b]/5 text-[#00205b]">
              {post.category_name}
            </Badge>
          ) : null}
          {post.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="border-[#00205b]/15 text-[#001433]/70">
              {tag}
            </Badge>
          ))}
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-[#001433] sm:text-3xl">
          <Link href={blogPostPath(post.slug)} className="hover:text-[#ba0c2f]">
            {post.title}
          </Link>
        </h2>
        {post.excerpt ? <p className="text-base leading-relaxed text-[#001433]/70">{post.excerpt}</p> : null}
        <p className="text-sm text-[#001433]/60">
          {post.author_label} · {formatBlogDate(post.published_at)} · {post.reading_time_minutes} min
        </p>
        <Link
          href={blogPostPath(post.slug)}
          className="inline-flex min-h-11 w-fit items-center justify-center rounded-full bg-[#00205b] px-5 text-sm font-semibold text-white hover:bg-[#ba0c2f]"
        >
          Les artikkelen
        </Link>
      </div>
    </article>
  );
}
