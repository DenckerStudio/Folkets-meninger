"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LogOut, Shield, UserCircle } from "lucide-react";
import { SmoothDropdown, type SmoothDropdownItem } from "@/components/ui/smooth-dropdown";
import { Dialog } from "@/components/ui/dialog";
import { ProfileAppPreferences } from "@/components/profile/profile-app-preferences";
import { PROFILE_TABS, type ProfileTabId } from "@/components/profile/profile-tabs";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { isAdminActive } from "@/lib/site-nav-links";
import { routes } from "@/lib/routes";

type ProfileMenuDropdownProps = {
  onSignOut: () => void | Promise<void>;
  className?: string;
};

const DROPDOWN_TAB_IDS = PROFILE_TABS
  .filter((tab) => tab.id !== "preferanser")
  .map((tab) => tab.id);

export function ProfileMenuDropdown({ onSignOut, className }: ProfileMenuDropdownProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const isAdminUser = useIsAdmin();
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const activeTab = searchParams.get("tab");
  const onMinSideOverview =
    pathname === routes.minSide || pathname === `${routes.minSide}/`;
  const onMinSideSubPage =
    pathname.startsWith(routes.minSide) &&
    Boolean(activeTab && DROPDOWN_TAB_IDS.includes(activeTab as ProfileTabId));

  const activeItemId = useMemo(() => {
    if (isAdminActive(pathname)) return "admin";
    if (onMinSideOverview) return "min-side";
    if (onMinSideSubPage) return activeTab;
    if (pathname.startsWith(routes.minSide)) return null;
    return null;
  }, [activeTab, onMinSideOverview, onMinSideSubPage, pathname]);

  const items = useMemo((): SmoothDropdownItem[] => {
    const menuItems: SmoothDropdownItem[] = [];

    if (!onMinSideSubPage) {
      menuItems.push({
        id: "min-side",
        label: "Min side",
        icon: UserCircle,
      });
    }

    menuItems.push(
      ...PROFILE_TABS.filter((tab) => tab.id !== "preferanser").map((tab) => ({
        id: tab.id,
        label: tab.label,
        icon: tab.icon,
      })),
    );

    menuItems.push(
      {
        id: "preferanser",
        label: "Preferanser",
        icon: PROFILE_TABS.find((tab) => tab.id === "preferanser")!.icon,
      },
      { id: "divider", label: "", icon: null, type: "divider" },
    );

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
  }, [isAdminUser, onMinSideSubPage]);

  const handleSelect = (id: string) => {
    if (id === "preferanser") {
      setPreferencesOpen(true);
      return;
    }

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

    if (DROPDOWN_TAB_IDS.includes(id as ProfileTabId)) {
      router.push(`${routes.minSide}?tab=${id}`);
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

  return (
    <>
      <SmoothDropdown
        items={items}
        activeItemId={activeItemId}
        onSelect={handleSelect}
        triggerAriaLabel="Profilmeny"
        className={className}
      />
      <Dialog
        open={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
        title="Preferanser"
        description="Utseende, animasjoner og hjelpetekster i saker."
        size="md"
        className="sm:max-w-md"
      >
        <ProfileAppPreferences />
      </Dialog>
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
