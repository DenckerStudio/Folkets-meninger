'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

export function useIsAdmin(): boolean {
  const { user } = useAuth();
  const [adminForUserId, setAdminForUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    fetch('/api/admin/me')
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          setIsAdmin(!!json.admin);
          setAdminForUserId(user.id);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsAdmin(false);
          setAdminForUserId(user.id);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || adminForUserId !== user.id) {
    return false;
  }

  return isAdmin;
}
