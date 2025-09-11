import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ChatWidget from '@/components/ChatWidget';
import { Toaster } from '@/components/ui/Toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SaveYours - CPR & First Aid Training | Minneapolis',
  description: 'Professional CPR and First Aid certification courses. Empowering individuals with life-saving skills.',
  keywords: 'CPR training, First Aid, BLS certification, AED training, Minneapolis, Minnesota',
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
      </body>
    </html>
  );
}