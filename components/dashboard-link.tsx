'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

type DashboardLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  externalClassName?: string;
};

export function DashboardLink({
  href,
  children,
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
          'text-brand hover:opacity-90 font-medium underline underline-offset-2 inline-flex items-center gap-1',
          externalClassName ?? className,
        )}
      >
        {children}
        <ExternalLink className="w-3 h-3 shrink-0" />
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        'text-brand hover:opacity-90 font-medium underline underline-offset-2',
        className,
      )}
    >
      {children}
    </Link>
  );
}
