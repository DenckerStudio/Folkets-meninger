export type SummaryField = 'hva' | 'hvem' | 'kostnad';

export type SummaryCards = Record<SummaryField, string>;

export const SUMMARY_FIELDS: SummaryField[] = ['hva', 'hvem', 'kostnad'];
