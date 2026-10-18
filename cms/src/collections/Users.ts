import type { CollectionConfig } from 'payload';
import { adminOrSelf, adminsOnly, adminsOnlyField, isEditor } from '@/access/roles';

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
    // Only admin/redaktor may use the admin panel (agent/reader are API-key users).
    admin: ({ req }) => isEditor(req.user as { role?: string } | null),
    // Admins see all users; everyone else only themselves (no listing of other users' emails).
    read: adminOrSelf,
    create: adminsOnly,
    // Self-update (e.g. own password) is allowed; the role field below is admin-only.
    update: adminOrSelf,
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
