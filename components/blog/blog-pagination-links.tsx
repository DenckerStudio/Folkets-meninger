import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getPageTokens } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/routes';

type BlogPaginationLinksProps = {
  currentPage: number;
  totalPages: number;
  basePath: string;
};

function pageHref(basePath: string, page: number): string {
  if (page <= 1) return basePath;
  if (basePath === routes.blogg) {
    return `${routes.blogg}/side/${page}`;
  }
  return `${basePath}/side/${page}`;
}

export function BlogPaginationLinks({ currentPage, totalPages, basePath }: BlogPaginationLinksProps) {
  if (totalPages <= 1) return null;
  const tokens = getPageTokens(currentPage, totalPages);
  const buttonBase =
    'inline-flex h-11 min-w-11 items-center justify-center rounded-xl border text-sm font-medium transition-colors';

  return (
    <nav aria-label="Paginering" className="flex flex-wrap items-center justify-center gap-1.5">
      <Link
        href={pageHref(basePath, currentPage - 1)}
        aria-label="Forrige side"
        className={cn(
          buttonBase,
          'border-[#00205b]/15 bg-white px-2 text-[#001433]',
          currentPage <= 1 && 'pointer-events-none opacity-40',
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>
      {tokens.map((token, index) =>
        token === 'gap' ? (
          <span
            key={`gap-${index}`}
            aria-hidden
            className="inline-flex h-11 min-w-6 items-end justify-center pb-3 text-sm text-[#001433]/55"
          >
            …
          </span>
        ) : (
          <Link
            key={token}
            href={pageHref(basePath, token)}
            aria-label={`Side ${token}`}
            aria-current={token === currentPage ? 'page' : undefined}
            className={cn(
              buttonBase,
              token === currentPage
                ? 'border-[#00205b] bg-[#00205b] text-white'
                : 'border-[#00205b]/15 bg-white text-[#001433] hover:bg-[#00205b]/[0.04]',
            )}
          >
            {token}
          </Link>
        ),
      )}
      <Link
        href={pageHref(basePath, currentPage + 1)}
        aria-label="Neste side"
        className={cn(
          buttonBase,
          'border-[#00205b]/15 bg-white px-2 text-[#001433]',
          currentPage >= totalPages && 'pointer-events-none opacity-40',
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </nav>
  );
}
