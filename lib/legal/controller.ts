/**
 * Behandlingsansvarlig — fyll inn fra Mathias før offentlig visning.
 * Tomme felt skjules i personvernerklæringen.
 */
export const DATA_CONTROLLER = {
  legalName: '' as string,
  orgNumber: '' as string,
  postalAddress: '' as string,
  privacyEmail: 'kontakt@folkets-meninger.no',
};

export function isDataControllerConfigured(): boolean {
  return Boolean(
    DATA_CONTROLLER.legalName.trim() &&
      DATA_CONTROLLER.orgNumber.trim() &&
      DATA_CONTROLLER.postalAddress.trim(),
  );
}

export function formatDataControllerBlock(): string | null {
  if (!isDataControllerConfigured()) {
    return null;
  }
  return `${DATA_CONTROLLER.legalName.trim()}, org.nr. ${DATA_CONTROLLER.orgNumber.trim()}, ${DATA_CONTROLLER.postalAddress.trim()}`;
}
