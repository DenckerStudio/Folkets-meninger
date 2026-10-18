import type { CollectionConfig } from 'payload';
import { contentWriters } from '@/access/roles';

export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: process.env.MEDIA_LOCAL_DIR || 'media',
    imageSizes: [
      { name: 'thumb', width: 400, height: undefined, position: 'centre' },
      { name: 'card', width: 800, height: undefined, position: 'centre' },
      { name: 'hero', width: 1600, height: undefined, position: 'centre' },
      { name: 'og', width: 1200, height: 630, position: 'centre' },
    ],
    adminThumbnail: 'thumb',
    focalPoint: true,
  },
  access: {
    read: () => true,
    // Readers (fm-web CMS_API_KEY) are read-only; only admin/redaktor/agent may write.
    create: contentWriters,
    update: contentWriters,
    delete: contentWriters,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'caption',
      type: 'text',
    },
    {
      name: 'credit',
      type: 'text',
    },
    {
      name: 'license',
      type: 'text',
    },
    {
      name: 'sourceUrl',
      type: 'text',
    },
  ],
};
