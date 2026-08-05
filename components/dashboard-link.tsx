'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { LinkHoverCard } from '@/components/ui/link-hover-card';
import { InternalLinkPreview } from '@/components/dashboard/internal-link-preview';
import type { ForumContextItem } from '@/lib/forum/context';
import {
  fallbackMetaFromPath,
  parseInternalDashboardPath,
} from '@/lib/forum/parse-body-links';
import { cn } from '@/lib/utils';

function isDashboardInternal(href: string): boolean {
  return href.startsWith('/dashboard/');
}

function previewForMeta(
  meta: ForumContextItem | { kind: ForumContextItem['kind'] | 'forum'; title: string; subtitle?: string | null },
  href: string
) {
  return <InternalLinkPreview item={meta} href={href} />;
}

type DashboardLinkProps = {
  href: string;
  children: React.ReactNode;
  meta?: ForumContextItem;
  className?: string;
  externalClassName?: string;
};

export function DashboardLink({
  href,
  children,
  meta,
  className,
  externalClassName,
}: DashboardLinkProps) {
  if (href.startsWith('http')) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-medium underline underline-offset-2 inline-flex items-center gap-1',
          externalClassName ?? className
        )}
      >
        {children}
        <ExternalLink className="w-3 h-3 shrink-0" />
      </a>
    );
  }

  if (isDashboardInternal(href)) {
    const resolvedMeta =
      meta ??
      fallbackMetaFromPath(href) ??
      (() => {
        const parsed = parseInternalDashboardPath(href);
        if (!parsed) return null;
        if (parsed.kind === 'forum') {
          return { kind: 'forum' as const, title: String(children), subtitle: null };
        }
        return fallbackMetaFromPath(href);
      })();

    if (resolvedMeta) {
      return (
        <LinkHoverCard
          href={href}
          preview={previewForMeta(resolvedMeta, href)}
          className={cn(
            'text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-medium underline underline-offset-2',
            className
          )}
        >
          {children}
        </LinkHoverCard>
      );
    }
  }

  return (
    <Link
      href={href}
      className={cn(
        'text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-medium underline underline-offset-2',
        className
      )}
    >
      {children}
    </Link>
  );
}
