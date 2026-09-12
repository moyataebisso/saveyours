import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ChatWidget from '@/components/ChatWidget';
import { Toaster } from '@/components/ui/Toaster';
import { Analytics } from '@vercel/analytics/next';

const inter = Inter({ subsets: ['latin'] });

// metadataBase lets every page's relative canonical + og:image resolve to
// absolute URLs. Sub-pages set their own title/description; anything they
// omit falls back to what's here.
export const metadata: Metadata = {
  metadataBase: new URL('https://www.saveyours.net'),
  title: {
    default: 'CPR, BLS & First Aid Classes in Bloomington, MN | SaveYours',
    template: '%s | SaveYours',
  },
  description:
    'Red Cross certified CPR/AED/First Aid and BLS classes in Bloomington, MN, plus on-site group training across the Twin Cities metro.',
  keywords: 'CPR training, First Aid, BLS certification, AED training, Bloomington, Minnesota, Twin Cities',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: 'https://www.saveyours.net/',
    siteName: 'SaveYours',
    title: 'CPR, BLS & First Aid Classes in Bloomington, MN | SaveYours',
    description:
      'Red Cross certified CPR/AED/First Aid and BLS classes in Bloomington, MN, plus on-site group training across the Twin Cities metro.',
    images: [{ url: '/images/hero-cpr-training.png', width: 1200, height: 630, alt: 'SaveYours CPR training' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CPR, BLS & First Aid Classes in Bloomington, MN | SaveYours',
    description:
      'Red Cross certified CPR/AED/First Aid and BLS classes in Bloomington, MN, plus on-site group training across the Twin Cities metro.',
    images: ['/images/hero-cpr-training.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
        <ChatWidget />
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}