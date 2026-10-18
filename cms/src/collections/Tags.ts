import type { CollectionConfig } from 'payload';
import { taxonomyReadAccess, taxonomyWriteAccess } from '@/access/roles';

export const Tags: CollectionConfig = {
  slug: 'tags',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    read: taxonomyReadAccess,
    create: taxonomyWriteAccess,
    update: taxonomyWriteAccess,
    delete: taxonomyWriteAccess,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'description', type: 'textarea' },
  ],
};
