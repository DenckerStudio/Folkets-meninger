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
      <h1 className="text-2xl font-bold tracking-tight text-[#001433]">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-[#001433]/70">{description}</p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button type="button" className="max-sm:min-h-11" onClick={onRetry}>
          Prøv igjen
        </Button>
        <Button variant="outline" className="max-sm:min-h-11" render={<Link href={secondaryHref} />}>
          {secondaryLabel}
        </Button>
      </div>
    </div>
  );
}
