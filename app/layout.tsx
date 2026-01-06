import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Beacon',
  description: 'Leadership hub for JDs, initiatives, and comms',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <div className="min-h-screen bg-background">
          <header className="border-b border-gray-200 bg-background/95 backdrop-blur-sm sticky top-0 z-50">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex h-16 items-center justify-start">
                <Link
                  href="/"
                  className="flex items-center gap-2 text-lg font-semibold tracking-tight text-gray-900"
                >
                  <Image
                    src="/trianz-logo-horizontal.png"
                    alt="Trianz"
                    width={120}
                    height={28}
                    priority
                  />
                  <span>Beacon</span>
                </Link>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
