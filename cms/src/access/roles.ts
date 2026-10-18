import type { Access, FieldAccess } from 'payload';

export type CmsRole = 'admin' | 'redaktor' | 'agent' | 'reader';

type UserLike = { role?: string } | null | undefined;

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

export function isEditor(user: UserLike): boolean {
  const role = roleOf(user);
  return role === 'admin' || role === 'redaktor';
}

export function isAgent(user: UserLike): boolean {
  return roleOf(user) === 'agent';
}

export const authenticated: Access = ({ req }) => Boolean(req.user);

export const editorsOnly: Access = ({ req }) => isEditor(req.user as UserLike);

export const adminsOnly: Access = ({ req }) => roleOf(req.user as UserLike) === 'admin';

export const publishedOrAuthenticated: Access = ({ req }) => {
  if (req.user) return true;
  return { _status: { equals: 'published' } };
};

export const canPublishField: FieldAccess = ({ req }) => isEditor(req.user as UserLike);
