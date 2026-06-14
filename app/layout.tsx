import type {Metadata} from 'next';
import './globals.css';
import { Navigation } from '@/components/navigation';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'Folkets Stemme',
  description: 'En nøytral plattform som brobygger mellom Stortinget og innbyggerne.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="no" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body className="bg-background text-foreground min-h-screen font-sans" suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-white focus:text-indigo-700 focus:rounded-lg focus:shadow"
        >
          Hopp til hovedinnhold
        </a>
        <Navigation>
          <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            {children}
          </main>
        </Navigation>
      </body>
    </html>
  );
}
