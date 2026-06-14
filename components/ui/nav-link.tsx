'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NavIsActive } from '@/lib/site-nav-links';

export type NavLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  isActive?: NavIsActive;
};

const navLinkBase = cn(
  'relative inline-flex items-center px-2.5 py-1.5 text-sm font-medium transition-colors motion-reduce:transition-none',
  'text-muted-foreground hover:text-foreground',
  'after:absolute after:bottom-0 after:left-2.5 after:h-0.5 after:rounded-full after:bg-[#00205b]',
  'after:transition-all after:duration-200 motion-reduce:after:transition-none',
);

export function NavLink({ href, children, className, isActive }: NavLinkProps) {
  const pathname = usePathname();
  const active =
    isActive?.(pathname) ?? (pathname === href || pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        navLinkBase,
        active
          ? 'text-[#00205b] after:w-[calc(100%-1.25rem)]'
          : 'after:w-0 hover:after:w-[calc(100%-1.25rem)]',
        className,
      )}
    >
      {children}
    </Link>
  );
}

type NavMenuLinkProps = {
  title: string;
  description?: string;
  icon: LucideIcon;
  href: string;
  isActive?: NavIsActive;
};

export function NavMenuLink({ title, description, icon: Icon, href, isActive }: NavMenuLinkProps) {
  const pathname = usePathname();
  const active =
    isActive?.(pathname) ?? (pathname === href || pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full flex-row gap-x-2 rounded-sm p-2 transition-colors motion-reduce:transition-none',
        'hover:bg-accent hover:text-accent-foreground',
        'focus:bg-accent focus:text-accent-foreground focus:outline-none',
        active && 'bg-accent/60 text-[#00205b]',
      )}
    >
      <div className="bg-background/40 flex aspect-square size-10 items-center justify-center rounded-md border shadow-sm">
        <Icon className="text-foreground size-4" />
      </div>
      <div className="flex flex-col items-start justify-center">
        <span className="font-medium">{title}</span>
        {description ? <span className="text-muted-foreground text-xs">{description}</span> : null}
      </div>
    </Link>
  );
}

export function useNavSectionActive(isActiveFns: NavIsActive[]): boolean {
  const pathname = usePathname();
  return isActiveFns.some((fn) => fn(pathname));
}
