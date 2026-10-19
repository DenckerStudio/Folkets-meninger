const SENSITIVE_CATEGORY_LABELS: Record<string, string> = {
  veldedig_boikott: 'Sensitivt: veldedig boikott',
};

export function formatSensitiveCategoryLabel(category: string | null | undefined): string {
  if (!category?.trim()) return 'Sensitivt tema';
  const key = category.trim();
  return SENSITIVE_CATEGORY_LABELS[key] ?? `Sensitivt: ${key.replace(/_/g, ' ')}`;
}

export function formatSensitiveTemaCell(sensitive: boolean, category: string | null): string {
  if (!sensitive) return 'Nei';
  return formatSensitiveCategoryLabel(category);
}
