import type { Metadata } from 'next';
import '@payloadcms/next/css';
import { RootLayout, handleServerFunctions } from '@payloadcms/next/layouts';
import type { ServerFunctionClient } from 'payload';
import config from '@payload-config';
import { importMap } from './admin/importMap';

const serverFunction: ServerFunctionClient = (clientArgs) =>
  handleServerFunctions({
    config,
    importMap,
    ...clientArgs,
  });

type Args = {
  children: React.ReactNode;
};

export const metadata: Metadata = {
  title: 'Folkets Meninger CMS',
  robots: 'noindex, nofollow',
};

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    {children}
  </RootLayout>
);

export default Layout;
