import { VURDER_FOCUS_RING } from '@/lib/admin/vurder-interaction-classes';
import type { BlogPostSourcePublic } from '@/lib/blog/types';
import { cn } from '@/lib/utils';

type BlogPostSourcesProps = {
  sources: readonly BlogPostSourcePublic[];
};

export function BlogPostSources({ sources }: BlogPostSourcesProps) {
  if (sources.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[#00205b]/10 bg-white p-6" aria-labelledby="blog-post-sources-heading">
      <h2 id="blog-post-sources-heading" className="text-xl font-bold text-[#001433]">
        Kilder
      </h2>
      <ol className="mt-4 list-decimal space-y-3 pl-5 text-[#001433]/80">
        {sources.map((source) => (
          <li key={`${source.index}-${source.url}`} id={`blog-source-${source.index}`} value={source.index}>
            <span className="font-medium text-[#001433]">{source.title}</span>
            {' — '}
            <span>{source.publisher}</span>
            {source.publishedAt ? (
              <span className="text-[#001433]/65"> · {source.publishedAt}</span>
            ) : null}
            <div className="mt-1">
              <a
                href={source.url}
                rel="noopener noreferrer"
                target="_blank"
                className={cn(
                  'block max-w-full break-all text-sm font-medium text-[#00205b] underline underline-offset-2 [overflow-wrap:anywhere] hover:text-[#ba0c2f]',
                  VURDER_FOCUS_RING,
                )}
              >
                {source.url}
              </a>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}