"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { LogOut, Shield, UserCircle } from "lucide-react";
import { ProfileMenuAccountTrigger } from "@/components/profile/profile-menu-account-trigger";
import { ProfileMenuAvatarTrigger } from "@/components/profile/profile-menu-avatar-trigger";
import { getProfileDisplayName } from "@/lib/profile/user-display";
import { SmoothDropdown, type SmoothDropdownItem } from "@/components/ui/smooth-dropdown";
import { Dialog } from "@/components/ui/dialog";
import { MIN_SIDE_NAV_ITEMS, isMinSidePath, resolveMinSideSectionId } from "@/lib/min-side/sections";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { isAdminActive } from "@/lib/site-nav-links";
import { routes } from "@/lib/routes";

type ProfileMenuDropdownProps = {
  onSignOut: () => void | Promise<void>;
  className?: string;
  trigger?: "icon" | "account" | "avatar";
  user?: User | null;
};

export function ProfileMenuDropdown({
  onSignOut,
  className,
  trigger = "icon",
  user = null,
}: ProfileMenuDropdownProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const isAdminUser = useIsAdmin();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const onMinSide = isMinSidePath(pathname);
  const activeSection = onMinSide ? resolveMinSideSectionId(pathname) : null;

  const activeItemId = useMemo(() => {
    if (isAdminActive(pathname)) return "admin";
    if (activeSection) return activeSection;
    return null;
  }, [activeSection, pathname]);

  const items = useMemo((): SmoothDropdownItem[] => {
    const menuItems: SmoothDropdownItem[] = [];

    if (!onMinSide) {
      menuItems.push({
        id: "min-side",
        label: "Min side",
        icon: UserCircle,
      });
    }

    menuItems.push(
      ...MIN_SIDE_NAV_ITEMS.filter((item) => item.id !== "oversikt").map((item) => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
      })),
    );

    menuItems.push({ id: "divider", label: "", icon: null, type: "divider" });

    if (isAdminUser) {
      menuItems.push({
        id: "admin",
        label: "Admin",
        icon: Shield,
      });
    }

    menuItems.push({
      id: "logout",
      label: "Logg ut",
      icon: LogOut,
      destructive: true,
    });

    return menuItems;
  }, [isAdminUser, onMinSide]);

  const handleSelect = (id: string) => {
    if (id === "logout") {
      setLogoutOpen(true);
      return;
    }

    if (id === "admin") {
      router.push(routes.admin);
      return;
    }

    if (id === "min-side") {
      router.push(routes.minSide);
      return;
    }

    const section = MIN_SIDE_NAV_ITEMS.find((item) => item.id === id);
    if (section) {
      router.push(section.href);
    }
  };

  const confirmSignOut = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
      setLogoutOpen(false);
    } finally {
      setSigningOut(false);
    }
  };

  const displayName = user ? getProfileDisplayName(user) : "";
  const email = user?.email ?? "";

  const menuHeader =
    user && trigger === "avatar"
      ? (
          <div className="px-2 pt-1">
            {displayName ? (
              <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
            ) : null}
            {email ? (
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            ) : null}
          </div>
        )
      : undefined;

  const triggerVariant =
    trigger === "account" ? "account-row" : trigger === "avatar" ? "avatar" : "default";

  return (
    <>
      <SmoothDropdown
        items={items}
        activeItemId={activeItemId}
        onSelect={handleSelect}
        triggerAriaLabel="Profilmeny"
        className={className}
        preferSheet={trigger === "account"}
        triggerVariant={triggerVariant}
        menuHeader={menuHeader}
        triggerContent={
          trigger === "account" && user
            ? <ProfileMenuAccountTrigger user={user} />
            : trigger === "avatar" && user
              ? <ProfileMenuAvatarTrigger user={user} />
              : undefined
        }
      />
      <Dialog
        open={logoutOpen}
        onClose={() => {
          if (!signingOut) setLogoutOpen(false);
        }}
        title="Logg ut?"
        description="Er du sikker på at du vil logge ut?"
        size="md"
        className="sm:max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setLogoutOpen(false)}
              disabled={signingOut}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={() => void confirmSignOut()}
              disabled={signingOut}
              className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              {signingOut ? "Logger ut…" : "Logg ut"}
            </button>
          </div>
        }
      >
        <span className="sr-only">Bekreft utlogging</span>
      </Dialog>
    </>
  );
}