import Link from 'next/link';
import { FileText, Gavel, Shield, File, ExternalLink, ArrowRight } from 'lucide-react';
import type { ForumContextItem, ForumContextKind } from '@/lib/forum/context';
import { cn } from '@/lib/utils';

const KIND_CONFIG: Record<
  ForumContextKind | 'external',
  { label: string; icon: typeof FileText; accent: string }
> = {
  sak: { label: 'Stortingssak', icon: FileText, accent: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  hearing: { label: 'Høring', icon: Gavel, accent: 'text-violet-700 bg-violet-50 border-violet-200' },
  politician: { label: 'Politiker', icon: Shield, accent: 'text-sky-700 bg-sky-50 border-sky-200' },
  document: { label: 'Dokument', icon: File, accent: 'text-gray-700 bg-gray-50 border-gray-200' },
  external: { label: 'Ekstern kilde', icon: ExternalLink, accent: 'text-amber-700 bg-amber-50 border-amber-200' },
};

type ForumSourceCardProps = {
  item: ForumContextItem | { kind: 'external'; id: string; title: string; href: string; subtitle?: string | null };
  variant?: 'compact' | 'full';
  className?: string;
};

export default function ForumSourceCard({ item, variant = 'full', className }: ForumSourceCardProps) {
  const config = KIND_CONFIG[item.kind];
  const Icon = config.icon;
  const isExternal = item.href.startsWith('http');
  const href = item.href.startsWith('/') ? item.href : item.href;

  const inner = (
    <>
      <div className={cn('flex items-center gap-2 mb-1.5', variant === 'compact' && 'mb-1')}>
        <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border', config.accent)}>
          <Icon className="w-3 h-3" />
          {config.label}
        </span>
        {isExternal && (
          <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Ekstern</span>
        )}
      </div>
      <p className={cn('font-semibold text-gray-900 leading-snug', variant === 'compact' ? 'text-sm line-clamp-1' : 'text-base')}>
        {item.title}
      </p>
      {(item.subtitle || ('meta' in item && item.meta)) && (
        <p className="text-xs text-gray-500 mt-0.5">{item.subtitle || ('meta' in item ? item.meta : null)}</p>
      )}
      {variant === 'full' && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 mt-2 group-hover:text-indigo-500">
          Åpne kilde
          <ArrowRight className="w-3 h-3" />
        </span>
      )}
    </>
  );

  const cardClass = cn(
    'group block rounded-xl border bg-white transition-all hover:shadow-md hover:border-indigo-200',
    variant === 'compact' ? 'p-3' : 'p-4',
    className
  );

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cardClass}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} className={cardClass}>
      {inner}
    </Link>
  );
}

export function ForumSourceList({
  items,
  variant = 'full',
  className,
}: {
  items: ForumContextItem[];
  variant?: 'compact' | 'full';
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {items.map((item) => (
        <ForumSourceCard key={`${item.kind}-${item.id}`} item={item} variant={variant} />
      ))}
    </div>
  );
}
