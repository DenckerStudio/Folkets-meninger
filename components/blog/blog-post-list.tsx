import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatBlogDate } from '@/lib/blog/format';
import { blogPostPath } from '@/lib/blog/urls';
import { BLOG_AUTHOR_LABEL, type BlogPostPublic } from '@/lib/blog/types';

type BlogPostListProps = {
  posts: BlogPostPublic[];
};

export function BlogPostList({ posts }: BlogPostListProps) {
  if (posts.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-[#00205b]/15 bg-white/80 px-6 py-14 text-center shadow-sm"
        data-landing-section
      >
        <p className="text-lg font-semibold text-[#001433]">Ingen artikler ennå</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#001433]/65">
          Vi publiserer forklaringer og oppsummeringer her når de er klare. Kom tilbake snart — eller utforsk
          saker og høringer i appen.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-6">
      {posts.map((post) => (
        <li key={post.slug} data-landing-section>
          <article className="rounded-2xl border border-[#00205b]/10 bg-white p-6 shadow-sm transition-colors hover:border-[#ba0c2f]/25">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#001433]/55">
              <time dateTime={post.published_at ?? undefined}>{formatBlogDate(post.published_at)}</time>
              <span aria-hidden>·</span>
              <span>{BLOG_AUTHOR_LABEL}</span>
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#001433]">
              <Link href={blogPostPath(post.slug)} className="hover:text-[#ba0c2f]">
                {post.title}
              </Link>
            </h2>
            {post.excerpt ? (
              <p className="mt-3 text-base leading-relaxed text-[#001433]/70">{post.excerpt}</p>
            ) : null}
            {post.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="bg-[#00205b]/5 text-[#00205b]">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
            <Link
              href={blogPostPath(post.slug)}
              className="mt-5 inline-flex text-sm font-semibold text-[#00205b] hover:text-[#ba0c2f]"
            >
              Les artikkelen →
            </Link>
          </article>
        </li>
      ))}
    </ul>
  );
}
