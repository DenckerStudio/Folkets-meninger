import type { Access, FieldAccess } from 'payload';

export type CmsRole = 'admin' | 'redaktor' | 'agent' | 'reader';

type UserLike = { id?: string | number; role?: string } | null | undefined;

export function roleOf(user: UserLike): CmsRole | null {
  if (!user?.role) return null;
  if (
    user.role === 'admin' ||
    user.role === 'redaktor' ||
    user.role === 'agent' ||
    user.role === 'reader'
  ) {
    return user.role;
  }
  return null;
}

export function isAdmin(user: UserLike): boolean {
  return roleOf(user) === 'admin';
}

export function isEditor(user: UserLike): boolean {
  const role = roleOf(user);
  return role === 'admin' || role === 'redaktor';
}

export function isAgent(user: UserLike): boolean {
  return roleOf(user) === 'agent';
}

/** admin, redaktor or agent (n8n). Readers (fm-web CMS_API_KEY) are excluded. */
export function isContentWriter(user: UserLike): boolean {
  return isEditor(user) || isAgent(user);
}

export const authenticated: Access = ({ req }) => Boolean(req.user);

export const editorsOnly: Access = ({ req }) => isEditor(req.user as UserLike);

export const contentWriters: Access = ({ req }) => isContentWriter(req.user as UserLike);

export const adminsOnly: Access = ({ req }) => isAdmin(req.user as UserLike);

/** Admins see every user; everyone else only their own user document. */
export const adminOrSelf: Access = ({ req }) => {
  const user = req.user as UserLike;
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (user.id === undefined || user.id === null) return false;
  return { id: { equals: user.id } };
};

export const publishedOrAuthenticated: Access = ({ req }) => {
  if (req.user) return true;
  return { _status: { equals: 'published' } };
};

export const canPublishField: FieldAccess = ({ req }) => isEditor(req.user as UserLike);

export const adminsOnlyField: FieldAccess = ({ req }) => isAdmin(req.user as UserLike);
