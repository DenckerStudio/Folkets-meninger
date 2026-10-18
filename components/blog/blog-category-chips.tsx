import Link from 'next/link';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/routes';
import type { BlogCategory } from '@/lib/blog/types';

type BlogCategoryChipsProps = {
  categories: BlogCategory[];
  activeSlug?: string | null;
};

export function BlogCategoryChips({ categories, activeSlug }: BlogCategoryChipsProps) {
  const active = activeSlug ?? null;

  return (
    <nav
      className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Tema"
    >
      <Link
        href={routes.blogg}
        className={cn(
          'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors',
          !active
            ? 'bg-[#00205b] text-white'
            : 'border border-[#00205b]/15 bg-white text-[#001433]/75 hover:border-[#ba0c2f]/30',
        )}
      >
        Alle
      </Link>
      {categories.map((category) => {
        const isActive = active === category.slug;
        return (
          <Link
            key={category.slug}
            href={`${routes.blogg}/tema/${encodeURIComponent(category.slug)}`}
            className={cn(
              'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-[#00205b] text-white'
                : 'border border-[#00205b]/15 bg-white text-[#001433]/75 hover:border-[#ba0c2f]/30',
            )}
          >
            {category.name}
          </Link>
        );
      })}
    </nav>
  );
}
