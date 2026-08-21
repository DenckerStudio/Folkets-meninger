'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Quote } from 'lucide-react';
import { motion } from 'motion/react';
import { useSakShareOptional } from '@/components/sak/sak-share-context';

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function ExpandableText({
  title,
  text,
  maxLength = 300,
}: {
  title: string;
  text: string;
  maxLength?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const share = useSakShareOptional();

  if (!text) return null;

  const displayText = stripHtml(text);
  const isLong = displayText.length > maxLength;

  return (
    <div className="mb-6 last:mb-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {share ? (
          <button
            type="button"
            onClick={() =>
              share.openQuoteShare({
                quote: displayText.slice(0, 600),
                sourceLabel: title,
              })
            }
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Quote className="h-3.5 w-3.5" />
            Del sitat
          </button>
        ) : null}
      </div>
      <div className="relative">
        <motion.div
          layout
          initial={false}
          className={`whitespace-pre-wrap text-muted-foreground ${!isExpanded && isLong ? 'line-clamp-4 overflow-hidden' : ''}`}
        >
          {displayText}
        </motion.div>
        {!isExpanded && isLong && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent" />
        )}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 inline-flex items-center text-sm font-medium text-brand hover:text-brand/80"
        >
          {isExpanded ? (
            <>
              Vis mindre <ChevronUp className="ml-1 w-4 h-4" />
            </>
          ) : (
            <>
              Les hele teksten <ChevronDown className="ml-1 w-4 h-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
