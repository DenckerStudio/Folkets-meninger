'use client';

import { useEffect } from 'react';

const SESSION_KEY_PREFIX = 'folkets:poll-share:';

export type PollShareLandingBeaconProps = {
  pollId: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  refCode: string | null;
  fmShare: string | null;
};

export function PollShareLandingBeacon({
  pollId,
  utmSource,
  utmMedium,
  utmCampaign,
  refCode,
  fmShare,
}: PollShareLandingBeaconProps) {
  useEffect(() => {
    const storageKey = `${SESSION_KEY_PREFIX}${pollId}`;

    try {
      if (window.sessionStorage.getItem(storageKey)) {
        return;
      }
      window.sessionStorage.setItem(storageKey, '1');
    } catch {
      // sessionStorage unavailable — still attempt one beacon
    }

    const shareCode = fmShare?.trim() ?? '';
    const body: Record<string, string> = {
      eventName: 'poll_share_landing',
      path: `/del/${pollId}`,
    };

    const referrer = document.referrer.trim();
    if (referrer) {
      body.referrer = referrer;
    }
    if (utmSource) {
      body.utm_source = utmSource;
    }
    if (utmMedium) {
      body.utm_medium = utmMedium;
    }
    if (utmCampaign) {
      body.utm_campaign = utmCampaign;
    }
    if (refCode) {
      body.ref = refCode;
    }
    if (shareCode) {
      body.shareCode = shareCode;
    }

    void fetch('/api/analytics/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
  }, [pollId, utmSource, utmMedium, utmCampaign, refCode, fmShare]);

  return null;
}
