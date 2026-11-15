import { getSporsmalEmner } from '@/lib/stortinget-sporsmal';
import type { StortingetSporsmal } from '@/lib/stortinget-sporsmal';
import { getSporsmalSearchText } from '@/lib/sporsmal/search-text';

export const SPORSMAL_FALLBACK_THEME = 'Annet';

export const SPORSMAL_THEME_LABELS = [
  'Helse og omsorg',
  'Skole og utdanning',
  'Klima og miljø',
  'Samferdsel',
  'Forsvar og beredskap',
  'Økonomi og skatt',
  'Arbeid og velferd',
  'Justis og innvandring',
  'Energi',
  'Landbruk og mat',
  'Bolig og plan',
  'Kultur og idrett',
  'Utenriks',
  SPORSMAL_FALLBACK_THEME,
] as const;

export type SporsmalThemeLabel = (typeof SPORSMAL_THEME_LABELS)[number];

const THEME_LABEL_SET = new Set<string>(SPORSMAL_THEME_LABELS);

export function isSporsmalThemeLabel(value: string): value is SporsmalThemeLabel {
  return THEME_LABEL_SET.has(value);
}

const MINISTER_THEME_RULES: Array<{ pattern: RegExp; theme: SporsmalThemeLabel }> = [
  { pattern: /finans|økonomi|nærings/, theme: 'Økonomi og skatt' },
  { pattern: /helse|eldr|helseombud/, theme: 'Helse og omsorg' },
  { pattern: /barne|familie|kunnskaps|utdann/, theme: 'Skole og utdanning' },
  { pattern: /klima|miljø/, theme: 'Klima og miljø' },
  { pattern: /samferdsel|transport/, theme: 'Samferdsel' },
  { pattern: /forsvar|justis|beredskap/, theme: 'Forsvar og beredskap' },
  { pattern: /arbeid|inkludering|trygd/, theme: 'Arbeid og velferd' },
  { pattern: /justis|innenriks|immigrasjon|integrering/, theme: 'Justis og innvandring' },
  { pattern: /energi|petroleum/, theme: 'Energi' },
  { pattern: /landbruk|mat|fiskeri/, theme: 'Landbruk og mat' },
  { pattern: /kommunal|distrikt|plan/, theme: 'Bolig og plan' },
  { pattern: /kultur|likestilling|idrett/, theme: 'Kultur og idrett' },
  { pattern: /utenriks/, theme: 'Utenriks' },
];

const KEYWORD_THEME_RULES: Array<{ keywords: string[]; theme: SporsmalThemeLabel }> = [
  { keywords: ['sykehus', 'helsepersonell', 'helsetjeneste', 'fastlege'], theme: 'Helse og omsorg' },
  { keywords: ['skole', 'lærer', 'universitet', 'utdanning'], theme: 'Skole og utdanning' },
  { keywords: ['klima', 'utslipp', 'utslipps', 'natur', 'biodiversitet'], theme: 'Klima og miljø' },
  { keywords: ['vei', 'jernbane', 'bane', 'flyplass', 'ferge'], theme: 'Samferdsel' },
  { keywords: ['forsvar', 'militær', 'politi', 'beredskap', 'sikkerhet'], theme: 'Forsvar og beredskap' },
  { keywords: ['skatt', 'budsjett', 'avgift', 'mva', 'formuesskatt'], theme: 'Økonomi og skatt' },
  { keywords: ['sykepenger', 'dagpenger', 'pensjon', 'arbeidsledig'], theme: 'Arbeid og velferd' },
  { keywords: ['asyl', 'innvandring', 'utsendelse', 'kriminalitet'], theme: 'Justis og innvandring' },
  { keywords: ['kraft', 'strøm', 'vindkraft', 'petroleum'], theme: 'Energi' },
  { keywords: ['jordbruk', 'bonde', 'fiske', 'matproduksjon'], theme: 'Landbruk og mat' },
  { keywords: ['bolig', 'boligpris', 'plan- og bygnings'], theme: 'Bolig og plan' },
  { keywords: ['kultur', 'idrett', 'film', 'musikk'], theme: 'Kultur og idrett' },
  { keywords: ['nato', 'ukraina', 'eu ', 'eu.', 'eøs'], theme: 'Utenriks' },
];

const EMNE_THEME_MAP: Record<string, SporsmalThemeLabel> = {
  helse: 'Helse og omsorg',
  utdanning: 'Skole og utdanning',
  klima: 'Klima og miljø',
  miljø: 'Klima og miljø',
  samferdsel: 'Samferdsel',
  forsvar: 'Forsvar og beredskap',
  økonomi: 'Økonomi og skatt',
  arbeid: 'Arbeid og velferd',
  trygder: 'Arbeid og velferd',
  justis: 'Justis og innvandring',
  energi: 'Energi',
  fiskeri: 'Landbruk og mat',
  landbruk: 'Landbruk og mat',
  bolig: 'Bolig og plan',
  kultur: 'Kultur og idrett',
  utenriks: 'Utenriks',
};

function mapEmneNavnToTheme(emneNavn: string): SporsmalThemeLabel | null {
  const needle = emneNavn.trim().toLowerCase();
  if (!needle) return null;
  for (const [key, theme] of Object.entries(EMNE_THEME_MAP)) {
    if (needle.includes(key)) return theme;
  }
  return null;
}

function mapMinisterToTheme(ministerTitle: string): SporsmalThemeLabel | null {
  if (!ministerTitle.trim()) return null;
  for (const rule of MINISTER_THEME_RULES) {
    if (rule.pattern.test(ministerTitle)) return rule.theme;
  }
  return null;
}

function mapKeywordsToTheme(text: string): SporsmalThemeLabel | null {
  for (const rule of KEYWORD_THEME_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) return rule.theme;
  }
  return null;
}

export type ResolveSporsmalThemeOptions = {
  /** Optional curated theme from backfill (`sporsmal.theme` column later). */
  theme?: string | null;
};

/**
 * Deterministic theme for grouping and filters. Keyword rules are ordered; first
 * match wins. A future optional DB `theme` column overrides everything else.
 */
export function resolveSporsmalTheme(
  item: StortingetSporsmal,
  options?: ResolveSporsmalThemeOptions,
): SporsmalThemeLabel {
  const override = options?.theme?.trim() ?? item.theme?.trim();
  if (override && isSporsmalThemeLabel(override)) {
    return override;
  }

  for (const emne of getSporsmalEmner(item)) {
    const mapped = mapEmneNavnToTheme(emne);
    if (mapped) return mapped;
  }

  const minister = (item.sporsmal_til_minister_tittel ?? '').toLowerCase();
  const fromMinister = mapMinisterToTheme(minister);
  if (fromMinister) return fromMinister;

  const text = getSporsmalSearchText(item).toLowerCase();
  return mapKeywordsToTheme(text) ?? SPORSMAL_FALLBACK_THEME;
}