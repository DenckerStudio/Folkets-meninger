export function formatWhen(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('nb-NO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
