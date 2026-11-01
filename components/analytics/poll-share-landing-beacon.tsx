'use client';

import { useEffect } from 'react';

const SESSION_KEY_PREFIX = 'folkets:poll-share:';

export type PollShareLandingBeaconProps = {
  pollId: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  refCode: string | null;
};

function buildLandingPath(
  pollId: string,
  utmSource: string | null,
  utmMedium: string | null,
  utmCampaign: string | null,
  refCode: string | null,
): string {
  const base = `/del/${pollId}`;
  const params = new URLSearchParams();
  if (utmSource) {
    params.set('utm_source', utmSource);
  }
  if (utmMedium) {
    params.set('utm_medium', utmMedium);
  }
  if (utmCampaign) {
    params.set('utm_campaign', utmCampaign);
  }
  if (refCode) {
    params.set('ref', refCode);
  }
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function PollShareLandingBeacon({
  pollId,
  utmSource,
  utmMedium,
  utmCampaign,
  refCode,
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

    const body: Record<string, string> = {
      eventName: 'poll_share_landing',
      path: buildLandingPath(pollId, utmSource, utmMedium, utmCampaign, refCode),
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

    void fetch('/api/analytics/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
  }, [pollId, utmSource, utmMedium, utmCampaign, refCode]);

  return null;
}
