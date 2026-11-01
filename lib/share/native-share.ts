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

/** Returns true when the user completed a native share sheet flow. */
export async function tryNativeShare(input: NativeShareInput): Promise<boolean> {
  if (!canUseNativeShare()) return false;
  const shareUrl = resolveShareUrl(
    input.channelUrl ? input.channelUrl('native') : input.url,
  );
  const text = (input.text ?? input.title).trim();
  try {
    await navigator.share({ title: input.title, text, url: shareUrl });
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return false;
    return false;
  }
}
