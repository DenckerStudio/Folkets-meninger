import type { CollectionConfig } from 'payload';
import { authenticated, publishedOrAuthenticated } from '@/access/roles';

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
    create: authenticated,
    update: authenticated,
    delete: authenticated,
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
