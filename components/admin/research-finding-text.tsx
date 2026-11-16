'use client';

import { UserAnnotatableText } from '@/components/user-annotations/user-annotatable-text';
import { useUserAnnotations } from '@/components/user-annotations/user-annotation-context';
import { cn } from '@/lib/utils';

export function ResearchFindingText({
  containerKey,
  text,
  className,
  as = 'p',
}: {
  containerKey: string;
  text: string;
  className?: string;
  as?: 'p' | 'div' | 'span';
}) {
  const ctx = useUserAnnotations();
  const value = text.trim();
  if (!value) return null;

  if (ctx?.enabled) {
    return (
      <UserAnnotatableText containerKey={containerKey} text={value} className={className} as={as} />
    );
  }

  const Tag = as;
  return <Tag className={cn(className)}>{value}</Tag>;
}