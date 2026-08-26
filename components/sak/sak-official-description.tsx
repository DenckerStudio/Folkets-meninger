'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const DEFAULT_PREVIEW_LENGTH = 280;

export function SakOfficialDescription({
  text,
  previewLength = DEFAULT_PREVIEW_LENGTH,
}: {
  text: string;
  previewLength?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const description = text.trim();
  if (!description) return null;

  const isLong = description.length > previewLength;

  return (
    <div className="space-y-2">
      <p className="text-base leading-relaxed text-muted-foreground">
        {isLong && !expanded ? `${description.slice(0, previewLength).trimEnd()}…` : description}
      </p>
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
