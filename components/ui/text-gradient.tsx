'use client';

import type { CSSProperties, ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type TextGradientProps = {
  children: ReactNode;
  as?: ElementType;
  colors?: string[];
  duration?: number;
  className?: string;
};

/**
 * Text Gradient (21st.dev / Cnippet).
 * Animated flowing gradient clipped to text.
 */
export function TextGradient({
  children,
  as: Tag = 'span',
  colors = ['#ba0c2f', '#00205b', '#ba0c2f', '#001433'],
  duration = 6,
  className,
}: TextGradientProps) {
  const gradient = `linear-gradient(90deg, ${colors.join(', ')})`;

  return (
    <Tag
      className={cn('fs-text-gradient inline-block bg-clip-text text-transparent', className)}
      style={
        {
          backgroundImage: gradient,
          backgroundSize: '200% auto',
          animationDuration: `${duration}s`,
        } as CSSProperties
      }
    >
      {children}
    </Tag>
  );
}
