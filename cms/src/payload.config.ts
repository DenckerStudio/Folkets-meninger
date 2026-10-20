import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { s3Storage } from '@payloadcms/storage-s3';
import { buildConfig } from 'payload';
import sharp from 'sharp';
import { migrations } from './migrations';
import { Authors } from '@/collections/Authors';
import { Categories } from '@/collections/Categories';
import { Media } from '@/collections/Media';
import { Posts } from '@/collections/Posts';
import { Tags } from '@/collections/Tags';
import { Users } from '@/collections/Users';
import { resolveCmsServerUrl, trustedPayloadOrigins } from '@/lib/serverOrigins';
import { seedOnBoot } from '@/seed/seedBaseData';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const plugins = [];

if (
  process.env.S3_BUCKET?.trim() &&
  process.env.S3_ACCESS_KEY_ID?.trim() &&
  process.env.S3_SECRET_ACCESS_KEY?.trim()
) {
  plugins.push(
    s3Storage({
      collections: {
        media: true,
      },
      bucket: process.env.S3_BUCKET!,
      config: {
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID!,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        },
        region: process.env.S3_REGION || 'eu-central-1',
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      },
    }),
  );
}

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: '— Folkets Meninger CMS',
    },
  },
  collections: [Users, Media, Categories, Tags, Authors, Posts],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'dev-only-change-me',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI,
    },
    schemaName: process.env.PAYLOAD_SCHEMA || 'payload',
    // Run pending migrations on boot when NODE_ENV=production (runtime image has no payload CLI/tsx/src).
    prodMigrations: migrations,
    disableCreateDatabase: true,
  }),
  sharp,
  plugins,
  cors: trustedPayloadOrigins(),
  csrf: trustedPayloadOrigins(),
  serverURL: resolveCmsServerUrl(),
  graphQL: {
    disablePlaygroundInProduction: true,
    disableIntrospectionInProduction: true,
  },
  onInit: async (payload) => {
    await seedOnBoot(payload);
  },
});
