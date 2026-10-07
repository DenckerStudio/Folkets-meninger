'use client';

import { NotificationsBell } from '@/components/notifications/notifications-bell';
import { useAuth } from '@/hooks/use-auth';

/** Legacy floating bell — prefer header NotificationsBell. Kept for reuse. */
export function MobileTopBar() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="md:hidden fixed top-0 right-0 z-40 p-3 safe-area-inset-top">
      <NotificationsBell />
    </div>
  );
}
