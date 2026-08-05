'use client';

import * as HoverCard from '@radix-ui/react-hover-card';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

type LinkHoverCardProps = {
  href: string;
  preview: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function LinkHoverCard({ href, preview, children, className }: LinkHoverCardProps) {
  const reduceMotion = useReducedMotion();

  return (
    <HoverCard.Root openDelay={180} closeDelay={120}>
      <HoverCard.Trigger asChild>
        <Link href={href} className={cn('cursor-pointer', className)}>
          {children}
        </Link>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          align="start"
          sideOffset={10}
          collisionPadding={12}
          className="z-[100] w-[min(320px,calc(100vw-2rem))] outline-none"
        >
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
            className="rounded-xl border border-border bg-card p-4 shadow-xl ring-1 ring-border/60"
          >
            {preview}
          </motion.div>
          <HoverCard.Arrow className="fill-white" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
