export type PublicAuthorKind = 'platform' | 'user';

export type PublicAuthorDisplay = {
  name: string;
  kind: PublicAuthorKind;
  initials: string;
  userId?: string | null;
};

export type UserNameFields = {
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
};

const MIN_NAME_LEN = 2;

export function isValidNamePart(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length >= MIN_NAME_LEN;
}

/** True when the user has public first + last name (required for hearings, etc.). */
export function userHasPublicIdentity(user: UserNameFields | null | undefined): boolean {
  if (!user) return false;
  return isValidNamePart(user.first_name) && isValidNamePart(user.last_name);
}

export function formatDisplayName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`;
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function resolvePublicAuthor(options: {
  userId?: string | null;
  users?: UserNameFields | UserNameFields[] | null;
}): PublicAuthorDisplay | null {
  const row = Array.isArray(options.users) ? options.users[0] : options.users;
  if (!row) return null;

  if (userHasPublicIdentity(row)) {
    const name = formatDisplayName(row.first_name!, row.last_name!);
    return { name, kind: 'user', initials: initialsFromName(name), userId: options.userId ?? null };
  }

  const legacy = row.name?.trim();
  if (legacy && legacy.length >= MIN_NAME_LEN * 2 + 1) {
    return { name: legacy, kind: 'user', initials: initialsFromName(legacy), userId: options.userId ?? null };
  }

  return null;
}

export function resolveHearingCommentAuthor(
  users: UserNameFields | UserNameFields[] | null | undefined,
): PublicAuthorDisplay | null {
  return resolvePublicAuthor({ users });
}

export const PUBLIC_IDENTITY_ERROR =
  'Du må fylle ut fornavn og etternavn under Min side før du kan publisere.';

/** @deprecated Use userHasPublicIdentity */
export const userHasForumIdentity = userHasPublicIdentity;

/** @deprecated Use PUBLIC_IDENTITY_ERROR */
export const FORUM_IDENTITY_ERROR = PUBLIC_IDENTITY_ERROR;
