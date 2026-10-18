import type { CollectionConfig } from 'payload';
import { adminsOnly, authenticated } from '@/access/roles';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    useAPIKey: true,
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
  },
  admin: {
    useAsTitle: 'email',
  },
  access: {
    read: authenticated,
    create: adminsOnly,
    update: adminsOnly,
    delete: adminsOnly,
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
        update: ({ req }) => req.user?.role === 'admin',
      },
    },
    {
      name: 'name',
      type: 'text',
    },
  ],
};
