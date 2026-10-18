import type { CollectionConfig } from 'payload';
import { authenticated } from '@/access/roles';

export const Authors: CollectionConfig = {
  slug: 'authors',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
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
