'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

type ForumAdminState = {
  userId: string | null;
  isAdmin: boolean;
};

export function useForumAdmin() {
  const { user } = useAuth();
  const [state, setState] = useState<ForumAdminState>({
    userId: null,
    isAdmin: false,
  });

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    fetch('/api/admin/me', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          setState({ userId: user.id, isAdmin: !!json.admin });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ userId: user.id, isAdmin: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return { isAdmin: false, loading: false };
  }

  return {
    isAdmin: state.userId === user.id ? state.isAdmin : false,
    loading: state.userId !== user.id,
  };
}
