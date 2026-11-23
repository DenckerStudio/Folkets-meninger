/** Nøkkelinfo «Saksnummer»: hold sesjonsår og parentes på samme linje. */
export function sakNummerMetaSessionPart(sakSesjon: string): string {
  const trimmed = sakSesjon.trim();
  return trimmed.startsWith('(') ? trimmed : `(${trimmed})`;
}