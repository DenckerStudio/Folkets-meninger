export const ACCOUNT_DELETE_CONFIRMATION_TOKEN = 'SLETT';

export const SELF_DELETE_STEMME_PLUS_BLOCK_MESSAGE =
  'Du har et aktivt Stemme+-abonnement. Avslutt abonnementet under Stemme+ på Min side før du sletter kontoen.';

export function stemmePlusBlockMessageWithPeriodEnd(formattedEndDate: string): string {
  return `Du har et aktivt Stemme+-abonnement. Du kan slette kontoen etter ${formattedEndDate}. Avslutt abonnementet under Stemme+ dersom du vil stoppe fornyelse før det.`;
}

export const SELF_DELETE_LAST_ADMIN_BLOCK_MESSAGE =
  'Du er den eneste administratoren. Utnevn en annen admin før du sletter kontoen.';

export const SELF_DELETE_MISSING_MIGRATION_MESSAGE =
  'Kontosletting er ikke tilgjengelig ennå fordi en database-oppdatering mangler på serveren. Prøv igjen senere, eller kontakt oss via innspill-siden.';

export const SELF_DELETE_RPC_FAILED_MESSAGE =
  'Vi klarte ikke å fullføre slettingen akkurat nå. Prøv igjen om litt, eller kontakt oss via innspill-siden.';

export const SELF_DELETE_AUTH_PENDING_MESSAGE =
  'Brukerdataene dine er slettet. Innloggingen fjernes så snart vi kan fullføre oppryddingen — logg ut nå. Hvis du fortsatt kan logge inn senere, kontakt oss via innspill-siden.';

export const ACCOUNT_DELETED_QUERY_PARAM = 'konto-slettet';

export const ACCOUNT_DELETED_LANDING_MESSAGE =
  'Kontoen din og tilknyttede personopplysninger er slettet.';