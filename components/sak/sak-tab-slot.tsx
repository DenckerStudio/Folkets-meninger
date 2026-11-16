import type { ReactNode } from 'react';

/**
 * Optional panel wrapper for future tab content. Renders nothing when empty — never placeholder copy.
 */
export function SakTabSlot({ children }: { children?: ReactNode }) {
  if (children == null) return null;
  return <>{children}</>;
}