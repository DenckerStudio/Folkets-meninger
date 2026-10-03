import { cn } from '@/lib/utils';

export const dashboardControlClassName =
  'block w-full appearance-none rounded-xl border border-border bg-background py-2 pl-3 pr-10 text-base text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30 sm:text-sm';

export const dashboardSearchClassName =
  'block w-full rounded-xl border border-border bg-background py-2 pl-10 pr-3 text-base text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30 sm:text-sm';

export function dashboardControlClass(className?: string) {
  return cn(dashboardControlClassName, className);
}

export function dashboardSearchClass(className?: string) {
  return cn(dashboardSearchClassName, className);
}
