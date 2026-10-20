import type { CollectionConfig } from 'payload';
import {
  adminsOnly,
  adminsOnlyField,
  isEditor,
  usersReadAccess,
  type UserLike,
} from '@/access/roles';
import { stripUserEmailForNonEditors } from '@/hooks/userPrivacy';
import { isProductionNodeEnv } from '@/lib/serverOrigins';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    useAPIKey: true,
    maxLoginAttempts: 5,
    lockTime: 900_000,
    tokenExpiration: 7200,
    cookies: {
      secure: isProductionNodeEnv(),
      sameSite: 'Lax',
    },
  },
  admin: {
    useAsTitle: 'email',
  },
  access: {
    admin: ({ req }) => isEditor(req.user as UserLike),
    read: usersReadAccess,
    create: adminsOnly,
    update: ({ req }) => {
      if (!req.user) return false;
      if (req.user.role === 'admin') return true;
      return { id: { equals: req.user.id } };
    },
    delete: adminsOnly,
  },
  hooks: {
    afterRead: [stripUserEmailForNonEditors],
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'redaktor',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Redaktør', value: 'redaktor' },
        { label: 'n8n-agent', value: 'agent' },
        { label: 'Leser (publisert)', value: 'reader' },
      ],
      access: {
        create: adminsOnlyField,
        update: adminsOnlyField,
      },
    },
    {
      name: 'name',
      type: 'text',
    },
  ],
};
