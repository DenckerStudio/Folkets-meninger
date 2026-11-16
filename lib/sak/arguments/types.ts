export type SakArgumentSide = 'for' | 'mot';

export type SakArgumentSourceKind = 'innstilling' | 'merknad' | 'mening';

export type SakArgumentSource = {
  kind: SakArgumentSourceKind;
  label: string;
  href?: string | null;
  /** In-page anchor / scroll target on sak page */
  anchorId?: string | null;
  documentId?: string | null;
};

export type SakArgumentItem = {
  id: string;
  side: SakArgumentSide;
  text: string;
  source: SakArgumentSource;
  /** Opinion aggregates only: number of matching public points */
  supportCount?: number;
};

export type SakArgumentsBundle = {
  for: SakArgumentItem[];
  mot: SakArgumentItem[];
  emptyMessage: string | null;
};