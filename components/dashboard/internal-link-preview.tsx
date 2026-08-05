import Link from 'next/link';
import { ArrowRight, ExternalLink, FileText, Gavel, MessageSquare, Shield } from 'lucide-react';
import type { ForumContextItem } from '@/lib/forum/context';
import { cn } from '@/lib/utils';

const KIND_CONFIG = {
  sak: { label: 'Stortingssak', icon: FileText, accent: 'text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' },
  hearing: { label: 'Høring', icon: Gavel, accent: 'text-violet-700 bg-violet-50 border-violet-200' },
  politician: { label: 'Politiker', icon: Shield, accent: 'text-sky-700 bg-sky-50 border-sky-200' },
  document: { label: 'Dokument', icon: FileText, accent: 'text-foreground bg-muted/40 border-border' },
  forum: { label: 'Forumtråd', icon: MessageSquare, accent: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
} as const;

type InternalLinkPreviewProps = {
  item: ForumContextItem | { kind: keyof typeof KIND_CONFIG; title: string; subtitle?: string | null };
  href: string;
  className?: string;
};

export function InternalLinkPreview({ item, href, className }: InternalLinkPreviewProps) {
  const config = KIND_CONFIG[item.kind as keyof typeof KIND_CONFIG] ?? KIND_CONFIG.sak;
  const Icon = config.icon;
  const subtitle = 'subtitle' in item ? item.subtitle : 'meta' in item ? item.meta : null;

  return (
    <div className={cn('space-y-2', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border',
          config.accent
        )}
      >
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
      <p className="text-sm font-semibold text-foreground leading-snug">{item.title}</p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      {href.startsWith('http') ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
        >
          Åpne kilde
          <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
        >
          Åpne kilde
          <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}
