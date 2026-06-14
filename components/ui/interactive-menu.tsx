'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './interactive-menu.css';

type IconComponentType = React.ElementType<{ className?: string }>;

export interface InteractiveMenuItem {
  label: string;
  icon: IconComponentType;
  href: string;
  isActive?: (pathname: string) => boolean;
}

export interface InteractiveMenuProps {
  items: InteractiveMenuItem[];
  accentColor?: string;
  className?: string;
}

const defaultAccentColor = 'var(--component-active-color-default)';

function resolveActiveIndex(items: InteractiveMenuItem[], pathname: string): number {
  const index = items.findIndex((item) =>
    item.isActive ? item.isActive(pathname) : pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return index >= 0 ? index : 0;
}

export function InteractiveMenu({ items, accentColor, className }: InteractiveMenuProps) {
  const pathname = usePathname();
  const finalItems = useMemo(() => {
    const isValid = Array.isArray(items) && items.length >= 2 && items.length <= 5;
    if (!isValid) {
      console.warn("InteractiveMenu: 'items' must contain 2–5 entries.", items);
      return [];
    }
    return items;
  }, [items]);

  const routeActiveIndex = useMemo(
    () => resolveActiveIndex(finalItems, pathname),
    [finalItems, pathname],
  );

  const [activeIndex, setActiveIndex] = useState(routeActiveIndex);

  useEffect(() => {
    setActiveIndex(routeActiveIndex);
  }, [routeActiveIndex]);

  useEffect(() => {
    if (activeIndex >= finalItems.length) {
      setActiveIndex(0);
    }
  }, [finalItems, activeIndex]);

  const textRefs = useRef<(HTMLElement | null)[]>([]);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const setLineWidth = () => {
      const activeItemElement = itemRefs.current[activeIndex];
      const activeTextElement = textRefs.current[activeIndex];

      if (activeItemElement && activeTextElement) {
        const textWidth = activeTextElement.offsetWidth;
        activeItemElement.style.setProperty('--lineWidth', `${textWidth}px`);
      }
    };

    setLineWidth();

    window.addEventListener('resize', setLineWidth);
    return () => {
      window.removeEventListener('resize', setLineWidth);
    };
  }, [activeIndex, finalItems]);

  const navStyle = useMemo(() => {
    const activeColor = accentColor || defaultAccentColor;
    return { '--component-active-color': activeColor } as React.CSSProperties;
  }, [accentColor]);

  if (finalItems.length === 0) {
    return null;
  }

  return (
    <nav className={['menu', className].filter(Boolean).join(' ')} role="navigation" style={navStyle}>
      {finalItems.map((item, index) => {
        const isActive = index === activeIndex;
        const IconComponent = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`menu__item ${isActive ? 'active' : ''}`}
            onClick={() => setActiveIndex(index)}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            style={{ '--lineWidth': '0px' } as React.CSSProperties}
            aria-current={isActive ? 'page' : undefined}
          >
            <div className="menu__icon">
              <IconComponent className="icon" />
            </div>
            <strong
              className={`menu__text ${isActive ? 'active' : ''}`}
              ref={(el) => {
                textRefs.current[index] = el;
              }}
            >
              {item.label}
            </strong>
          </Link>
        );
      })}
    </nav>
  );
}
