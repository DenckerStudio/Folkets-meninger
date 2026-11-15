'use client';

import { useCallback, useState } from 'react';
import { useAnnotationContainerExpand } from '@/components/user-annotations/use-annotation-container-expand';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { UserAnnotatableText } from '@/components/user-annotations/user-annotatable-text';
import { useUserAnnotations } from '@/components/user-annotations/user-annotation-context';

const DEFAULT_PREVIEW_LENGTH = 220;

export function SakOfficialDescription({
  text,
  previewLength = DEFAULT_PREVIEW_LENGTH,
}: {
  text: string;
  previewLength?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const expand = useCallback(() => setExpanded(true), []);
  useAnnotationContainerExpand('official_description', expand);
  const annotationCtx = useUserAnnotations();
  const description = text.trim();
  if (!description) return null;

  const isLong = description.length > previewLength;
  const displayText =
    isLong && !expanded ? `${description.slice(0, previewLength).trimEnd()}…` : description;

  return (
    <div className="space-y-2">
      {annotationCtx?.enabled ? (
        <UserAnnotatableText
          containerKey="official_description"
          text={displayText}
          className="text-base leading-relaxed text-muted-foreground"
        />
      ) : (
        <p className="text-base leading-relaxed text-muted-foreground">{displayText}</p>
      )}
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              Vis mindre <ChevronUp className="h-4 w-4" aria-hidden />
            </>
          ) : (
            <>
              Les mer <ChevronDown className="h-4 w-4" aria-hidden />
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}
