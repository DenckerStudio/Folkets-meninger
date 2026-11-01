const SHARE_TARGET_ID_RE = /^[A-Za-z0-9_.:-]{1,200}$/;

const SHARE_TARGET_KINDS = ['poll', 'blog_post', 'sak', 'generic'] as const;

export type ShareTargetKind = (typeof SHARE_TARGET_KINDS)[number];

export function personalSharePath(code: string): string {
  return `/l/${encodeURIComponent(code)}`;
}

export function isShareTargetKind(kind: string): kind is ShareTargetKind {
  return (SHARE_TARGET_KINDS as readonly string[]).includes(kind);
}

export function isShareTargetId(targetId: string): boolean {
  if (!SHARE_TARGET_ID_RE.test(targetId)) return false;
  if (targetId === '.' || targetId.includes('..')) return false;
  return true;
}

function pathForKind(kind: ShareTargetKind, targetId: string): string | null {
  switch (kind) {
    case 'poll':
      return `/del/${encodeURIComponent(targetId)}`;
    case 'blog_post':
      return `/blogg/${encodeURIComponent(targetId)}`;
    case 'sak':
      return `/dashboard/sak/${encodeURIComponent(targetId)}`;
    case 'generic':
      return null;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** Relative in-app path for a stored share target. Generic and unknown kinds stay put. */
export function resolveShareTarget(kind: string, targetId: string): string | null {
  if (!isShareTargetId(targetId) || !isShareTargetKind(kind)) {
    return null;
  }
  const path = pathForKind(kind, targetId);
  if (path == null) {
    return null;
  }
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('//')) {
    return null;
  }
  return path;
}
