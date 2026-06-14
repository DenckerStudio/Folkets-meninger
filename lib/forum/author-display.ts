import { FORUM_SYSTEM_AUTHOR_NAME } from '@/lib/forum/admin';

export type ForumAuthorKind = 'platform' | 'user';

export type ForumAuthorDisplay = {
  name: string;
  kind: ForumAuthorKind;
  initials: string;
};

export type UserNameFields = {
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
};

const MIN_NAME_LEN = 2;

export function isValidForumNamePart(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length >= MIN_NAME_LEN;
}

export function userHasForumIdentity(user: UserNameFields | null | undefined): boolean {
  if (!user) return false;
  return isValidForumNamePart(user.first_name) && isValidForumNamePart(user.last_name);
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

export function resolveForumAuthor(options: {
  isSystemThread?: boolean;
  users?: UserNameFields | UserNameFields[] | null;
}): ForumAuthorDisplay | null {
  if (options.isSystemThread) {
    return {
      name: FORUM_SYSTEM_AUTHOR_NAME,
      kind: 'platform',
      initials: 'FS',
    };
  }

  const row = Array.isArray(options.users) ? options.users[0] : options.users;
  if (!row) return null;

  if (userHasForumIdentity(row)) {
    const name = formatDisplayName(row.first_name!, row.last_name!);
    return { name, kind: 'user', initials: initialsFromName(name) };
  }

  const legacy = row.name?.trim();
  if (legacy && legacy.length >= MIN_NAME_LEN * 2 + 1) {
    return { name: legacy, kind: 'user', initials: initialsFromName(legacy) };
  }

  return null;
}

export function resolveHearingCommentAuthor(
  users: UserNameFields | UserNameFields[] | null | undefined,
): ForumAuthorDisplay | null {
  return resolveForumAuthor({ isSystemThread: false, users });
}
