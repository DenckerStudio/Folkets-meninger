import type { Metadata } from 'next';
import { RootPage } from '@payloadcms/next/views';
import config from '@payload-config';
import { importMap } from '../importMap';

type Args = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<Record<string, string | string[]>>;
};

export const generateMetadata = async (): Promise<Metadata> => ({
  title: 'Admin — Folkets Meninger CMS',
  robots: 'noindex, nofollow',
});

const Page = async ({ params, searchParams }: Args) =>
  RootPage({ config, importMap, params, searchParams });

export default Page;
