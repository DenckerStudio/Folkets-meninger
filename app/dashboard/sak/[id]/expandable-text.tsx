'use client';

import { useCallback, useState } from 'react';
import { useAnnotationContainerExpand } from '@/components/user-annotations/use-annotation-container-expand';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'motion/react';
import { UserAnnotatableText } from '@/components/user-annotations/user-annotatable-text';
import { useUserAnnotations } from '@/components/user-annotations/user-annotation-context';

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function containerKeyForTitle(title: string): string {
  return `expandable_${title.toLowerCase().replace(/\s+/g, '_').slice(0, 80)}`;
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
  const annotationCtx = useUserAnnotations();
  const containerKey = containerKeyForTitle(title);
  const expand = useCallback(() => setIsExpanded(true), []);
  useAnnotationContainerExpand(containerKey, expand);

  if (!text) return null;

  const displayText = stripHtml(text);
  const isLong = displayText.length > maxLength;
  const shown =
    !isExpanded && isLong ? `${displayText.slice(0, maxLength).trimEnd()}…` : displayText;

  return (
    <div className="mb-6 last:mb-0">
      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">{title}</h3>
      <div className="relative">
        <motion.div layout initial={false} className="relative">
          {annotationCtx?.enabled ? (
            <UserAnnotatableText
              containerKey={containerKey}
              text={shown}
              as="div"
              className={`break-words whitespace-pre-wrap text-muted-foreground ${!isExpanded && isLong ? 'line-clamp-4 overflow-hidden' : ''}`}
            />
          ) : (
            <div
              className={`break-words whitespace-pre-wrap text-muted-foreground ${!isExpanded && isLong ? 'line-clamp-4 overflow-hidden' : ''}`}
            >
              {shown}
            </div>
          )}
        </motion.div>
        {!isExpanded && isLong && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        )}
      </div>
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 inline-flex items-center text-sm font-medium text-brand hover:text-brand/80 transition-colors"
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
