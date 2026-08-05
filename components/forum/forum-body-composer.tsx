'use client';

import { useMemo } from 'react';
import type { ForumContextItem } from '@/lib/forum/context';
import { parseBodySegments } from '@/lib/forum/parse-body-links';
import { DashboardLink } from '@/components/dashboard-link';
import { cn } from '@/lib/utils';

type ForumBodyComposerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  linkedItems?: ForumContextItem[];
  maxLength?: number;
  placeholder?: string;
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  rows?: number;
};

export function ForumBodyComposer({
  id,
  value,
  onChange,
  linkedItems = [],
  maxLength,
  placeholder,
  className,
  textareaRef,
  rows = 12,
}: ForumBodyComposerProps) {
  const segments = useMemo(() => parseBodySegments(value, linkedItems), [value, linkedItems]);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-muted/40 shadow-sm ring-1 ring-border transition-shadow focus-within:bg-card focus-within:ring-2 focus-within:ring-indigo-500/30',
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words"
      >
        {segments.map((segment, index) => {
          if (segment.type === 'text') {
            return (
              <span key={index} className="text-foreground">
                {segment.text}
              </span>
            );
          }

          if (segment.type === 'mention') {
            return (
              <span
                key={index}
                className="rounded bg-indigo-50 dark:bg-indigo-950/40 px-1 font-medium text-indigo-700 dark:text-indigo-300"
              >
                {segment.text}
              </span>
            );
          }

          return (
            <span key={index} className="pointer-events-auto">
              <DashboardLink href={segment.href} meta={segment.meta} className="font-medium">
                {segment.label}
              </DashboardLink>
            </span>
          );
        })}
      </div>

      <textarea
        ref={textareaRef}
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        spellCheck
        className="relative block min-h-[220px] w-full resize-y bg-transparent px-4 py-3 text-sm leading-relaxed text-transparent caret-gray-900 placeholder:text-muted-foreground selection:bg-indigo-200/60 focus:outline-none"
      />
    </div>
  );
}
