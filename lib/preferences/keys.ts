export const PREFERENCE_KEYS = {
  app: {
    preferences: 'folkets:app:preferences',
  },
  utforsk: {
    /** @deprecated Migrated to `sort`; removed on read. */
    filters: 'folkets:utforsk:filters',
    sort: 'folkets:utforsk:sort',
  },
  politikere: {
    search: 'folkets:politikere:search',
  },
  impact: {
    profile: 'folkets:impact:profile',
  },
} as const;
