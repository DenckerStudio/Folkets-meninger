'use client';

import { useState } from 'react';
import { ChevronDown, Shield } from 'lucide-react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { FORUM_RULES_ITEMS } from '@/lib/forum/forum-rules';
import { cn } from '@/lib/utils';

type ForumRulesPanelProps = {
  className?: string;
  defaultOpen?: boolean;
};

export function ForumRulesPanel({ className = '', defaultOpen = false }: ForumRulesPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        aria-expanded={open}
      >
        <Shield className="h-4 w-4 text-indigo-600" aria-hidden />
        Forumregler
        <ChevronDown
          className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-70',
          reducedMotion && 'transition-none',
        )}
      >
        <div className="overflow-hidden">
          <ul className="mt-3 space-y-2 rounded-xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
            {FORUM_RULES_ITEMS.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
