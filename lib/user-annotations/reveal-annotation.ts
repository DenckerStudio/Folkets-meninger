import { dispatchUserAnnotationExpand } from '@/lib/user-annotations/expand-container';

export async function scrollToAnnotationMark(annotationId: string, containerKey: string): Promise<boolean> {
  dispatchUserAnnotationExpand(containerKey);
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  const el = document.querySelector(`[data-annotation-id="${CSS.escape(annotationId)}"]`);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (el instanceof HTMLElement) {
    el.focus({ preventScroll: true });
  }
  return true;
}