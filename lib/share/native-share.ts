import { resolveShareUrl, type ShareChannel } from '@/lib/share/targets';

export function canUseNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export type NativeShareInput = {
  title: string;
  text?: string;
  url: string;
  channelUrl?: (channel: ShareChannel) => string;
};

export type NativeShareResult = 'shared' | 'aborted' | 'unavailable' | 'failed';

function isShareAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/** Outcome of a native share attempt (never throws). */
export async function tryNativeShare(input: NativeShareInput): Promise<NativeShareResult> {
  if (!canUseNativeShare()) return 'unavailable';
  const shareUrl = resolveShareUrl(
    input.channelUrl ? input.channelUrl('native') : input.url,
  );
  const text = (input.text ?? input.title).trim();
  try {
    await navigator.share({ title: input.title, text, url: shareUrl });
    return 'shared';
  } catch (err) {
    if (isShareAbortError(err)) return 'aborted';
    return 'failed';
  }
}

export { isShareAbortError };
