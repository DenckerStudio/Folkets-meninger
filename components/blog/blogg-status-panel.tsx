'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

type BloggStatusPanelProps = {
  title: string;
  description: string;
  onRetry: () => void;
  secondaryHref: string;
  secondaryLabel: string;
};

export function BloggStatusPanel({
  title,
  description,
  onRetry,
  secondaryHref,
  secondaryLabel,
}: BloggStatusPanelProps) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button type="button" onClick={onRetry}>
          Prøv igjen
        </Button>
        <Button variant="outline" render={<Link href={secondaryHref} />}>
          {secondaryLabel}
        </Button>
      </div>
    </div>
  );
}
