import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Sora } from 'next/font/google';
import { UserMenu } from '@/components/auth/user-menu';
import './globals.css';

const sora = Sora({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sora',
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
    <html lang="en" className={sora.variable}>
      <body className="font-sans antialiased">
        <div className="min-h-screen bg-background">
          <header className="border-b border-gray-200 bg-background/95 backdrop-blur-sm sticky top-0 z-50">
            <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8">
              <div className="flex h-16 items-center justify-between">
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
                <UserMenu />
              </div>
            </div>
          </header>
          <main className="relative mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
              <div className="absolute -left-16 top-10 h-64 w-64 rounded-full bg-gradient-to-br from-blue-200 via-white to-transparent opacity-60 blur-3xl" />
              <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-gradient-to-tr from-emerald-200 via-white to-transparent opacity-50 blur-3xl" />
            </div>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
