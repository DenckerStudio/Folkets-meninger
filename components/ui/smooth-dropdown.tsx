"use client";

import { useState, useRef, useEffect, useSyncExternalStore, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import useMeasure from "react-use-measure";
import { MoreHorizontalCircle01Icon } from "@hugeicons/core-free-icons";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type SmoothDropdownItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }> | null;
  type?: "item" | "divider";
  destructive?: boolean;
};

type SmoothDropdownProps = {
  items: SmoothDropdownItem[];
  activeItemId?: string | null;
  onSelect: (id: string) => void;
  triggerAriaLabel?: string;
  className?: string;
};

const easeOutQuint: [number, number, number, number] = [0.23, 1, 0.32, 1];

type MenuListProps = {
  items: SmoothDropdownItem[];
  activeItemId: string | null;
  hoveredItem: string | null;
  isOpen: boolean;
  animated: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
};

function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function MenuList({
  items,
  activeItemId,
  hoveredItem,
  isOpen,
  animated,
  onHover,
  onSelect,
}: MenuListProps) {
  return (
    <ul className="m-0! flex list-none! flex-col gap-0.5 p-0!">
      {items.map((item, index) => {
        if (item.type === "divider" || item.id === "divider") {
          if (animated) {
            return (
              <motion.hr
                key={`divider-${index}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: isOpen ? 1 : 0 }}
                transition={{ delay: isOpen ? 0.12 + index * 0.015 : 0 }}
                className="my-1.5! border-border"
              />
            );
          }

          return <hr key={`divider-${index}`} className="my-1.5! border-border" />;
        }

        const Icon = item.icon;
        const isActive = activeItemId === item.id;
        const isLogout = item.destructive ?? item.id === "logout";
        const showIndicator = hoveredItem ? hoveredItem === item.id : isActive;
        const itemDuration = isLogout ? 0.12 : 0.15;
        const itemDelay = isOpen ? 0.06 + index * 0.02 : 0;

        const itemClassName = cn(
          "relative m-0! flex cursor-pointer items-center gap-3 rounded-lg py-2.5! pl-3! text-sm transition-colors duration-200 ease-out",
          isLogout && showIndicator
            ? "text-red-600 dark:text-red-400"
            : isActive
              ? "text-foreground"
              : isLogout
                ? "text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                : "text-muted-foreground hover:text-foreground",
        );

        const content = (
          <>
            {showIndicator ? (
              <motion.div
                layoutId={animated ? "activeIndicator" : undefined}
                className={cn(
                  "absolute inset-0 rounded-lg",
                  isLogout ? "bg-red-50 dark:bg-red-950/40" : "bg-muted",
                )}
                transition={{
                  type: "spring",
                  damping: 30,
                  stiffness: 520,
                  mass: 0.8,
                }}
              />
            ) : null}
            {showIndicator ? (
              <motion.div
                layoutId={animated ? "leftBar" : undefined}
                className={cn(
                  "absolute top-0 bottom-0 left-0 my-auto h-5 w-[3px] rounded-full",
                  isLogout ? "bg-red-500" : "bg-foreground",
                )}
                transition={{
                  type: "spring",
                  damping: 30,
                  stiffness: 520,
                  mass: 0.8,
                }}
              />
            ) : null}
            {Icon ? <Icon className="relative z-10 h-[18px] w-[18px] shrink-0" /> : null}
            <span className="relative z-10 font-medium">{item.label}</span>
          </>
        );

        if (animated) {
          return (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{
                opacity: isOpen ? 1 : 0,
                x: isOpen ? 0 : 8,
              }}
              transition={{
                delay: itemDelay,
                duration: itemDuration,
                ease: easeOutQuint,
              }}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(item.id);
              }}
              onMouseEnter={() => onHover(item.id)}
              onMouseLeave={() => onHover(null)}
              className={itemClassName}
            >
              {content}
            </motion.li>
          );
        }

        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              onMouseEnter={() => onHover(item.id)}
              onMouseLeave={() => onHover(null)}
              className={cn(itemClassName, "w-full text-left")}
            >
              {content}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function MobileProfileSheet({
  isOpen,
  triggerAriaLabel,
  items,
  activeItemId,
  hoveredItem,
  onHover,
  onSelect,
  onClose,
}: {
  isOpen: boolean;
  triggerAriaLabel: string;
  items: SmoothDropdownItem[];
  activeItemId: string | null;
  hoveredItem: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-[65] bg-foreground/45 backdrop-blur-[1px]"
            aria-label="Lukk meny"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={triggerAriaLabel}
            className="fixed inset-x-0 bottom-0 z-[70] max-h-[min(85vh,640px)] overflow-y-auto rounded-t-2xl border border-border bg-popover shadow-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 360, mass: 0.9 }}
          >
            <div className="sticky top-0 z-10 border-b border-border bg-popover/95 px-4 py-3 backdrop-blur">
              <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">Profilmeny</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Lukk
                </button>
              </div>
            </div>
            <div className="p-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
              <div className="mx-auto max-w-lg">
                <MenuList
                  items={items}
                  activeItemId={activeItemId}
                  hoveredItem={hoveredItem}
                  isOpen={isOpen}
                  animated={false}
                  onHover={onHover}
                  onSelect={onSelect}
                />
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export function SmoothDropdown({
  items,
  activeItemId = null,
  onSelect,
  triggerAriaLabel = "Åpne meny",
  className,
}: SmoothDropdownProps) {
  const isMobile = useIsMobile();
  const isMounted = useIsMounted();
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contentRef, contentBounds] = useMeasure();

  useEffect(() => {
    if (!isOpen || isMobile) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, isMobile]);

  useEffect(() => {
    if (!isOpen || !isMobile) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isMobile]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const openHeight = Math.max(40, Math.ceil(contentBounds.height));

  const handleItemSelect = (id: string) => {
    onSelect(id);
    setIsOpen(false);
  };

  const triggerButton = (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-popover text-muted-foreground shadow-sm transition-colors hover:bg-muted"
      aria-label={triggerAriaLabel}
      aria-expanded={isOpen}
    >
      <HugeiconsIcon icon={MoreHorizontalCircle01Icon} className="h-6 w-6" aria-hidden />
    </button>
  );

  const mobileSheet =
    isMounted && isMobile
      ? createPortal(
          <MobileProfileSheet
            isOpen={isOpen}
            triggerAriaLabel={triggerAriaLabel}
            items={items}
            activeItemId={activeItemId}
            hoveredItem={hoveredItem}
            onHover={setHoveredItem}
            onSelect={handleItemSelect}
            onClose={() => setIsOpen(false)}
          />,
          document.body,
        )
      : null;

  if (isMobile) {
    return (
      <div className={cn("not-prose", className)}>
        {triggerButton}
        {mobileSheet}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative h-10 w-10 not-prose", className)}>
      <motion.div
        layout
        initial={false}
        animate={{
          width: isOpen ? 240 : 40,
          height: isOpen ? openHeight : 40,
          borderRadius: isOpen ? 14 : 12,
        }}
        transition={{
          type: "spring" as const,
          damping: 34,
          stiffness: 380,
          mass: 0.8,
        }}
        className="absolute top-0 right-0 z-50 origin-top-right cursor-pointer overflow-hidden border border-border bg-popover shadow-lg"
        onClick={() => !isOpen && setIsOpen(true)}
      >
        <motion.div
          initial={false}
          animate={{
            opacity: isOpen ? 0 : 1,
            scale: isOpen ? 0.8 : 1,
          }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 flex items-center justify-center"
          style={{
            pointerEvents: isOpen ? "none" : "auto",
            willChange: "transform",
          }}
        >
          <HugeiconsIcon
            icon={MoreHorizontalCircle01Icon}
            className="h-6 w-6 text-muted-foreground"
            aria-hidden
          />
          <span className="sr-only">{triggerAriaLabel}</span>
        </motion.div>

        <div ref={contentRef}>
          <motion.div
            layout
            initial={false}
            animate={{
              opacity: isOpen ? 1 : 0,
            }}
            transition={{
              duration: 0.2,
              delay: isOpen ? 0.08 : 0,
            }}
            className="p-2"
            style={{
              pointerEvents: isOpen ? "auto" : "none",
              willChange: "transform",
            }}
          >
            <MenuList
              items={items}
              activeItemId={activeItemId}
              hoveredItem={hoveredItem}
              isOpen={isOpen}
              animated
              onHover={setHoveredItem}
              onSelect={handleItemSelect}
            />
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

export default SmoothDropdown;
