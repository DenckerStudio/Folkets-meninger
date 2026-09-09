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

  const activeTab = searchParams.get("tab");
  const activeItemId = useMemo(() => {
    if (isAdminActive(pathname)) return "admin";
    if (pathname.startsWith(routes.minSide)) {
      if (activeTab && DROPDOWN_TAB_IDS.includes(activeTab as ProfileTabId)) {
        return activeTab;
      }
      return "min-side";
    }
    return null;
  }, [activeTab, pathname]);

  const items = useMemo((): SmoothDropdownItem[] => {
    const menuItems: SmoothDropdownItem[] = [
      {
        id: "min-side",
        label: "Min side",
        icon: UserCircle,
      },
      ...PROFILE_TABS.filter((tab) => tab.id !== "preferanser").map((tab) => ({
        id: tab.id,
        label: tab.label,
        icon: tab.icon,
      })),
      {
        id: "preferanser",
        label: "Preferanser",
        icon: PROFILE_TABS.find((tab) => tab.id === "preferanser")!.icon,
      },
      { id: "divider", label: "", icon: null, type: "divider" },
    ];

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
  }, [isAdminUser]);

  const handleSelect = (id: string) => {
    if (id === "preferanser") {
      setPreferencesOpen(true);
      return;
    }

    if (id === "logout") {
      void onSignOut();
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
    </>
  );
}
