/** Behandlingsansvarlig (vist på /personvern og /vilkar). */
export const DATA_CONTROLLER = {
  legalName: 'Dencker (enkeltpersonforetak)',
  orgNumber: '934538498',
  postalAddress: 'Ileveien 10, 1407 Vinterbro',
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
