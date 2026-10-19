import Link from 'next/link';
import type { BlogPostPublic } from '@/lib/blog/types';
import { routes } from '@/lib/routes';

type BlogAuthorBoxProps = {
  post: BlogPostPublic;
};

export function BlogAuthorBox({ post }: BlogAuthorBoxProps) {
  const author = post.authors[0];
  const name = author?.name ?? post.author_label;

  return (
    <aside className="rounded-2xl border border-[#00205b]/10 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#001433]/55">Forfatter</p>
      <h2 className="mt-2 text-lg font-semibold text-[#001433]">{name}</h2>
      {author?.bio ? <p className="mt-2 text-sm leading-relaxed text-[#001433]/70">{author.bio}</p> : null}
      {post.ai_assisted ? (
        <p className="mt-4 text-sm leading-relaxed text-[#001433]/70">
          Utkast laget med AI-støtte ({post.ai_model_family ?? 'gemma4'}), gjennomgått og godkjent av
          redaksjonen.
        </p>
      ) : null}
      <Link
        href={routes.blogg}
        className="mt-4 inline-flex text-sm font-semibold text-[#00205b] hover:text-[#ba0c2f]"
      >
        Alle innlegg →
      </Link>
    </aside>
  );
}
