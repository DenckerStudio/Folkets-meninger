'use client';

import { useEffect, useState } from 'react';
import type { EarnedBadge } from '@/lib/knowledge/types';
import type { UserPointsProgress } from '@/lib/user-points-levels';
import type { StanceHistoryItem } from '@/lib/stances/types';
import { useAuth } from '@/hooks/use-auth';

export type MinSideProfileData = {
  loading: boolean;
  stanceHistory: StanceHistoryItem[];
  historyLoading: boolean;
  interestCategories: string[];
  interestLabels: string[];
  categoriesSaving: boolean;
  labelsSaving: boolean;
  notifEmailEnabled: boolean;
  notifFreq: Record<string, string>;
  notifSaving: boolean;
  points: number;
  pointsProgress: UserPointsProgress | null;
  badges: EarnedBadge[];
  fylkeCode: string | null;
  isStemmePlus: boolean;
  setInterestCategories: (next: string[]) => void;
  setInterestLabels: (next: string[]) => void;
  onCategoriesSave: () => Promise<void>;
  onLabelsSave: () => Promise<void>;
  onNotifEmailChange: (value: boolean) => void;
  onNotifFreqChange: (channel: string, value: string) => void;
  onNotifSave: () => Promise<void>;
  onFylkeSaved: (code: string | null) => void;
};

export function useMinSideProfileData(): MinSideProfileData {
  const { user, loading } = useAuth();
  const [stanceHistory, setStanceHistory] = useState<StanceHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [interestCategories, setInterestCategories] = useState<string[]>([]);
  const [interestLabels, setInterestLabels] = useState<string[]>([]);
  const [categoriesSaving, setCategoriesSaving] = useState(false);
  const [labelsSaving, setLabelsSaving] = useState(false);
  const [notifEmailEnabled, setNotifEmailEnabled] = useState(true);
  const [notifFreq, setNotifFreq] = useState<Record<string, string>>({
    categories: 'daily',
    labels: 'daily',
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [points, setPoints] = useState(0);
  const [pointsProgress, setPointsProgress] = useState<UserPointsProgress | null>(null);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [fylkeCode, setFylkeCode] = useState<string | null>(null);
  const [isStemmePlus, setIsStemmePlus] = useState(false);

  useEffect(() => {
    if (!user) {
      setHistoryLoading(false);
      return;
    }

    fetch('/api/user/stance-history')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setStanceHistory(data);
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/notifications/categories', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json.categories)) setInterestCategories(json.categories);
      })
      .catch(() => {});

    fetch('/api/notifications/labels', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json.labels)) setInterestLabels(json.labels);
      })
      .catch(() => {});

    fetch('/api/user/profile', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (typeof json.points === 'number') setPoints(json.points);
        if (json.points_progress) setPointsProgress(json.points_progress);
        if (Array.isArray(json.badges)) setBadges(json.badges);
        if (typeof json.fylke_code === 'string' || json.fylke_code === null) {
          setFylkeCode(json.fylke_code);
        }
        if (typeof json.stemme_plus === 'boolean') {
          setIsStemmePlus(json.stemme_plus);
        }
      })
      .catch(() => {});

    fetch('/api/stemme-plus/status', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (json.tier === 'stemme_plus') setIsStemmePlus(true);
      })
      .catch(() => {});

    fetch('/api/notifications/preferences', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (json.preferences) {
          if (typeof json.preferences.email_enabled === 'boolean') {
            setNotifEmailEnabled(json.preferences.email_enabled);
          }
          if (
            json.preferences.email_frequency_by_channel &&
            typeof json.preferences.email_frequency_by_channel === 'object'
          ) {
            setNotifFreq((prev) => ({
              ...prev,
              ...json.preferences.email_frequency_by_channel,
            }));
          }
        }
      })
      .catch(() => {});
  }, [user]);

  const onFylkeSaved = (code: string | null) => {
    setFylkeCode(code);
    fetch('/api/user/profile', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (typeof json.points === 'number') setPoints(json.points);
        if (Array.isArray(json.badges)) setBadges(json.badges);
      })
      .catch(() => {});
  };

  return {
    loading,
    stanceHistory,
    historyLoading,
    interestCategories,
    interestLabels,
    categoriesSaving,
    labelsSaving,
    notifEmailEnabled,
    notifFreq,
    notifSaving,
    points,
    pointsProgress,
    badges,
    fylkeCode,
    isStemmePlus,
    setInterestCategories,
    setInterestLabels,
    onCategoriesSave: async () => {
      setCategoriesSaving(true);
      try {
        await fetch('/api/notifications/categories', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ categories: interestCategories }),
        });
      } finally {
        setCategoriesSaving(false);
      }
    },
    onLabelsSave: async () => {
      setLabelsSaving(true);
      try {
        await fetch('/api/notifications/labels', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ labels: interestLabels }),
        });
      } finally {
        setLabelsSaving(false);
      }
    },
    onNotifEmailChange: setNotifEmailEnabled,
    onNotifFreqChange: (channel, value) => setNotifFreq((prev) => ({ ...prev, [channel]: value })),
    onNotifSave: async () => {
      setNotifSaving(true);
      try {
        await fetch('/api/notifications/preferences', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email_enabled: notifEmailEnabled,
            email_frequency_by_channel: notifFreq,
          }),
        });
      } finally {
        setNotifSaving(false);
      }
    },
    onFylkeSaved,
  };
}