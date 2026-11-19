'use client';

import type { ReactNode } from 'react';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import { TextHighlighter } from '@/components/ui/text-highlighter';
import { splitHighlightPhrase } from '@/lib/landing/highlight-phrase';
import { cn } from '@/lib/utils';

export type HighlightPhraseVariant = 'marker' | 'shiny';

type HighlightPhraseProps = {
  text: string;
  highlight: string;
  variant?: HighlightPhraseVariant;
  className?: string;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p';
};

function Keyword({
  variant,
  children,
}: {
  variant: HighlightPhraseVariant;
  children: ReactNode;
}) {
  switch (variant) {
    case 'shiny':
      return <AnimatedShinyText>{children}</AnimatedShinyText>;
    case 'marker':
      return <TextHighlighter>{children}</TextHighlighter>;
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}

/**
 * Renders a sentence with one whole-word keyword animated.
 * The full `text` stays in the accessibility tree via the parent tag.
 */
export function HighlightPhrase({
  text,
  highlight,
  variant = 'marker',
  className,
  as: Tag = 'span',
}: HighlightPhraseProps) {
  const parts = splitHighlightPhrase(text, highlight);

  if (!parts) {
    return <Tag className={className}>{text}</Tag>;
  }

  return (
    <Tag className={cn(className)}>
      {parts.before}
      <Keyword variant={variant}>{parts.match}</Keyword>
      {parts.after}
    </Tag>
  );
}
