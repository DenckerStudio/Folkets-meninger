/** Debatt- og stemmevennlige sakstyper fra Stortingets API. */
export type SakKind = 'lovforslag' | 'representantforslag';

export type SakPresentationInput = {
  korttittel?: string | null;
  tittel?: string | null;
  henvisning?: string | null;
  dokumentgruppe?: number | null;
};

const LOVFORSLAG_HENVISNING = /\b(?:Prop\.\s*\d+\s*L|Innst\.\s*\d+\s*L|Lovvedtak)\b/i;
const REPRESENTANTFORSLAG_HENVISNING = /Dokument\s*8\b/i;

export function classifySakKind(sak: SakPresentationInput): SakKind | null {
  const henvisning = (sak.henvisning ?? '').trim();
  const dokumentgruppe = sak.dokumentgruppe ?? null;

  if (dokumentgruppe === 1 && LOVFORSLAG_HENVISNING.test(henvisning)) {
    return 'lovforslag';
  }

  if (dokumentgruppe === 4 && REPRESENTANTFORSLAG_HENVISNING.test(henvisning)) {
    return 'representantforslag';
  }

  return null;
}

export function isDebattSak(sak: SakPresentationInput): sak is SakPresentationInput & { sakKind: SakKind } {
  return classifySakKind(sak) !== null;
}

export function getSakKindLabel(kind: SakKind): string {
  switch (kind) {
    case 'lovforslag':
      return 'Lovforslag';
    case 'representantforslag':
      return 'Representantforslag';
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** Official Stortinget short title (`korttittel`), falling back to `tittel`. Never paraphrased. */
export function buildSakDisplayTitle(sak: SakPresentationInput): string {
  const korttittel = (sak.korttittel || '').trim();
  const tittel = (sak.tittel || '').trim();
  return korttittel || tittel;
}

/** Official Stortinget long title (`tittel`) when it adds information beyond the short title. */
export function buildSakDisplaySummary(sak: SakPresentationInput, displayTitle: string): string {
  const tittel = (sak.tittel || '').trim();
  if (tittel && tittel !== displayTitle) {
    return tittel;
  }
  return '';
}

export function buildSakCategory(sak: SakPresentationInput, emneNavn?: string | null): string {
  if (emneNavn?.trim()) {
    return emneNavn.trim();
  }

  const kind = classifySakKind(sak);
  if (kind) {
    return getSakKindLabel(kind);
  }

  return 'Generelt';
}

export function mapSakPresentation(sak: SakPresentationInput & { emneNavn?: string | null }) {
  const kind = classifySakKind(sak);
  const title = buildSakDisplayTitle(sak);
  const summary = buildSakDisplaySummary(sak, title);
  const category = buildSakCategory(sak, sak.emneNavn);

  return {
    kind,
    title,
    summary,
    category,
    henvisning: (sak.henvisning || '').trim() || null,
  };
}
