const TARGET_KIND_LABELS: Record<string, string> = {
  poll: 'Avstemning',
  blog_post: 'Blogg',
  sak: 'Sak',
  generic: 'Lenke',
};

export function shareTargetKindLabel(kind: string): string {
  return TARGET_KIND_LABELS[kind] ?? kind;
}
