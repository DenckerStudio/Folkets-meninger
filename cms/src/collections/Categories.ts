import type { CollectionConfig } from 'payload';
import { contentWriters } from '@/access/roles';

export const Categories: CollectionConfig = {
  slug: 'categories',
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
    { name: 'description', type: 'textarea' },
    { name: 'order', type: 'number', defaultValue: 0 },
  ],
};
