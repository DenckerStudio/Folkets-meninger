'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

export function useIsAdmin(): boolean {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    let cancelled = false;

    fetch('/api/admin/me')
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setIsAdmin(!!json.admin);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return isAdmin;
}
