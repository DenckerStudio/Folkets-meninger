import type { CollectionConfig } from 'payload';
import { contentWriters } from '@/access/roles';

export const Authors: CollectionConfig = {
  slug: 'authors',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    read: () => true,
    // Readers (fm-web CMS_API_KEY) are read-only; only admin/redaktor/agent may write.
    create: contentWriters,
    update: contentWriters,
    delete: contentWriters,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'organization',
      options: [
        { label: 'Person', value: 'person' },
        { label: 'Organisasjon', value: 'organization' },
      ],
    },
    { name: 'role', type: 'text' },
    { name: 'bio', type: 'textarea' },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'sameAs',
      type: 'array',
      fields: [{ name: 'url', type: 'text', required: true }],
    },
  ],
};
