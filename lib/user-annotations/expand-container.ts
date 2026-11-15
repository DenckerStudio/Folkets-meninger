export const USER_ANNOTATION_EXPAND_EVENT = 'fm-user-annotation-expand';

export function dispatchUserAnnotationExpand(containerKey: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(USER_ANNOTATION_EXPAND_EVENT, {
      detail: { containerKey },
    }),
  );
}