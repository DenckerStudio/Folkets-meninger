"use client";

import { useState, useRef, useEffect, type ComponentType } from "react";
import { motion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import useMeasure from "react-use-measure";
import { MoreHorizontalCircle01Icon } from "@hugeicons/core-free-icons";

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

export function SmoothDropdown({
  items,
  activeItemId = null,
  onSelect,
  triggerAriaLabel = "Åpne meny",
  className,
}: SmoothDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contentRef, contentBounds] = useMeasure();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const openHeight = Math.max(40, Math.ceil(contentBounds.height));

  const handleItemSelect = (id: string) => {
    onSelect(id);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative h-10 w-10 not-prose ${className ?? ""}`}>
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
        className="absolute top-0 right-0 bg-popover border border-border shadow-lg overflow-hidden cursor-pointer origin-top-right"
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
            className="w-6 h-6 text-muted-foreground"
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
            <ul className="flex flex-col gap-0.5 m-0! p-0! list-none!">
              {items.map((item, index) => {
                if (item.type === "divider" || item.id === "divider") {
                  return (
                    <motion.hr
                      key={`divider-${index}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: isOpen ? 1 : 0 }}
                      transition={{ delay: isOpen ? 0.12 + index * 0.015 : 0 }}
                      className="border-border my-1.5!"
                    />
                  );
                }

                const Icon = item.icon;
                const isActive = activeItemId === item.id;
                const isLogout = item.destructive ?? item.id === "logout";
                const showIndicator = hoveredItem ? hoveredItem === item.id : isActive;
                const itemDuration = isLogout ? 0.12 : 0.15;
                const itemDelay = isOpen ? 0.06 + index * 0.02 : 0;

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
                      handleItemSelect(item.id);
                    }}
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className={`relative flex items-center gap-3 rounded-lg text-sm cursor-pointer transition-colors duration-200 ease-out m-0! pl-3! py-2! ${
                      isLogout && showIndicator
                        ? "text-red-600 dark:text-red-400"
                        : isActive
                          ? "text-foreground"
                          : isLogout
                            ? "text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {showIndicator ? (
                      <motion.div
                        layoutId="activeIndicator"
                        className={`absolute inset-0 rounded-lg ${
                          isLogout ? "bg-red-50 dark:bg-red-950/40" : "bg-muted"
                        }`}
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
                        layoutId="leftBar"
                        className={`absolute left-0 top-0 bottom-0 my-auto w-[3px] h-5 rounded-full ${
                          isLogout ? "bg-red-500" : "bg-foreground"
                        }`}
                        transition={{
                          type: "spring",
                          damping: 30,
                          stiffness: 520,
                          mass: 0.8,
                        }}
                      />
                    ) : null}
                    {Icon ? <Icon className="w-[18px] h-[18px] relative z-10 shrink-0" /> : null}
                    <span className="font-medium relative z-10">{item.label}</span>
                  </motion.li>
                );
              })}
            </ul>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

export default SmoothDropdown;
