export type CmsFetchReason = 'unconfigured' | 'http' | 'network';

export class CmsFetchError extends Error {
  readonly reason: CmsFetchReason;

  constructor(message: string, reason: CmsFetchReason) {
    super(message);
    this.name = 'CmsFetchError';
    this.reason = reason;
  }
}
