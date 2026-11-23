export type MarkLinkedDraftPrReadyPull = { number: number; url: string };

export type MarkLinkedDraftPrReadyResult =
  | { ok: true; pull: MarkLinkedDraftPrReadyPull; commentFailed?: true }
  | { ok: false; skipped: true }
  | { ok: false; readyFailed: true; pull: MarkLinkedDraftPrReadyPull; error: string }
  | { ok: false; error: string };