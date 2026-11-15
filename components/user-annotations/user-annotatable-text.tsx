'use client';

import { useCallback, useId, useRef, type ReactNode } from 'react';
import { buildHighlightSegments, captureSelectionInRoot } from '@/lib/user-annotations/selection';
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

  const onMouseUp = useCallback(() => {
    if (!ctx?.enabled || !rootRef.current) return;
    const selection = window.getSelection();
    if (!selection) return;
    const captured = captureSelectionInRoot(rootRef.current, selection);
    if (!captured) return;
    ctx.setPending({
      container_key: containerKey,
      ...captured,
    });
    selection.removeAllRanges();
  }, [containerKey, ctx]);

  const segments = buildHighlightSegments(text, marks);

  const content =
    children ??
    segments.map((seg, idx) =>
      seg.highlighted ? (
        <mark
          key={`${seg.annotationId ?? 'hl'}-${idx}`}
          className={cn(
            'rounded-sm bg-amber-200/80 text-foreground dark:bg-amber-500/35',
            ctx?.focusAnnotationId === seg.annotationId && 'ring-2 ring-brand ring-offset-1',
          )}
          data-annotation-id={seg.annotationId}
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
      className={cn(enabled && 'select-text', className)}
      onMouseUp={enabled ? onMouseUp : undefined}
      ref={(node) => {
        rootRef.current = node;
      }}
    >
      {content}
    </Tag>
  );
}