const CHANNEL_LABELS: Record<string, string> = {
  direct: 'Direkte',
  search_google: 'Google',
  search_other: 'Annet søk',
  social_facebook: 'Facebook',
  social_bluesky: 'Bluesky',
  social_linkedin: 'LinkedIn',
  social_whatsapp: 'WhatsApp',
  email: 'E-post',
  other: 'Annet',
};

export function channelBucketLabel(bucket: string): string {
  return CHANNEL_LABELS[bucket] ?? bucket;
}
