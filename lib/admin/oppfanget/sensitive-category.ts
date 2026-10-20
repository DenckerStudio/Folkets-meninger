const SENSITIVE_CATEGORY_LABELS: Record<string, string> = {
  veldedig_boikott: 'veldedig boikott',
};

export function formatSensitiveCategoryLabel(category: string | null | undefined): string {
  if (!category?.trim()) return 'Ikke oppgitt';
  const key = category.trim();
  return SENSITIVE_CATEGORY_LABELS[key] ?? key.replace(/_/g, ' ');
}

export function formatSensitiveTemaCell(sensitive: boolean, category: string | null): string {
  if (!sensitive) return 'Nei';
  return formatSensitiveCategoryLabel(category);
}
