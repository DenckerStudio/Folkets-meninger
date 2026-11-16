'use client';

import { useId, useRef, type ReactNode } from 'react';
import { buildHighlightSegments } from '@/lib/user-annotations/selection';
import {
  DEFAULT_USER_ANNOTATION_FLAG_TYPE,
  USER_ANNOTATION_FLAG_LABELS,
  USER_ANNOTATION_FLAG_STYLES,
  isUserAnnotationFlagType,
} from '@/lib/user-annotations/flag-types';
import { cn } from '@/lib/utils';
import { useUserAnnotations } from '@/components/user-annotations/user-annotation-context';

export function UserAnnotatableText({
  containerKey,
  text,
  className,
  as: Tag = 'p',
  children,
}: {
  containerKey: string;
  text: string;
  className?: string;
  as?: 'p' | 'div' | 'span';
  children?: ReactNode;
}) {
  const ctx = useUserAnnotations();
  const rootRef = useRef<HTMLElement | null>(null);
  const regionId = useId();

  const enabled = ctx?.enabled ?? false;
  const marks = enabled ? ctx?.annotationsByContainer.get(containerKey) ?? [] : [];

  const segments = buildHighlightSegments(text, marks);

  const content =
    children ??
    segments.map((seg, idx) =>
      seg.highlighted ? (
        <mark
          key={`${seg.annotationId ?? 'hl'}-${idx}`}
          tabIndex={seg.annotationId ? -1 : undefined}
          className={cn(
            'rounded-sm text-foreground',
            USER_ANNOTATION_FLAG_STYLES[
              isUserAnnotationFlagType(seg.flagType) ? seg.flagType : DEFAULT_USER_ANNOTATION_FLAG_TYPE
            ].mark,
            ctx?.focusAnnotationId === seg.annotationId && 'ring-2 ring-brand ring-offset-2',
          )}
          data-annotation-id={seg.annotationId}
          aria-label={`Markering: ${
            USER_ANNOTATION_FLAG_LABELS[
              isUserAnnotationFlagType(seg.flagType) ? seg.flagType : DEFAULT_USER_ANNOTATION_FLAG_TYPE
            ]
          }`}
        >
          {seg.text}
        </mark>
      ) : (
        <span key={`plain-${idx}`}>{seg.text}</span>
      ),
    );

  return (
    <Tag
      id={regionId}
      data-annotation-container={containerKey}
      className={cn(enabled && 'select-text touch-manipulation', className)}
      ref={(node) => {
        rootRef.current = node;
      }}
    >
      {content}
    </Tag>
  );
}