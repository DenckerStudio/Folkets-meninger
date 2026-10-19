/** Vis konfidens på bokmål (prosent eller desimal med komma). */
export function formatOppfangetConfidence(value: number): string {
  if (!Number.isFinite(value)) return '';
  const asPercent = value <= 1 ? value : value / 100;
  if (asPercent >= 0 && asPercent <= 1) {
    return `${asPercent.toLocaleString('nb-NO', { style: 'percent', maximumFractionDigits: 0 })} sikker`;
  }
  return `Konf. ${value.toLocaleString('nb-NO', { maximumFractionDigits: 2 })}`;
}
