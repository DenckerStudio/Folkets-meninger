import type {Metadata} from 'next';
import './globals.css';
import { Navigation } from '@/components/navigation';
import { ThemeProvider } from '@/components/theme-provider';
import { THEME_INIT_SCRIPT } from '@/lib/preferences/theme-init-script';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { siteOrigin } from '@/lib/share';

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: 'Folkets Stemme',
  description: 'En nøytral plattform som brobygger mellom Stortinget og innbyggerne.',
  openGraph: {
    type: 'website',
    locale: 'nb_NO',
    siteName: 'Folkets Stemme',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="no" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-background text-foreground min-h-screen font-sans" suppressHydrationWarning>
        <ThemeProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-background focus:text-indigo-700 dark:text-indigo-300 focus:rounded-lg focus:shadow"
          >
            Hopp til hovedinnhold
          </a>
          <Navigation>
            <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
              {children}
            </main>
          </Navigation>
        </ThemeProvider>
      </body>
    </html>
  );
}
