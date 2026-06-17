'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'motion/react';

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

  if (!text) return null;

  const displayText = stripHtml(text);
  const isLong = displayText.length > maxLength;

  return (
    <div className="mb-6 last:mb-0">
      <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider mb-2">{title}</h3>
      <div className="relative">
        <motion.div
          layout
          initial={false}
          className={`whitespace-pre-wrap text-muted-foreground ${!isExpanded && isLong ? 'line-clamp-4 overflow-hidden' : ''}`}
        >
          {displayText}
        </motion.div>
        {!isExpanded && isLong && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        )}
      </div>
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
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
