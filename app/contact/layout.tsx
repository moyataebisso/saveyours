import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    absolute: 'Contact SaveYours — Group Training & Class Questions',
  },
  description:
    'Contact SaveYours in Bloomington, MN for CPR, AED, BLS, and First Aid class questions, or to request an on-site group training quote in the Twin Cities metro.',
  alternates: { canonical: '/contact' },
  openGraph: {
    url: '/contact',
    title: 'Contact SaveYours — Group Training & Class Questions',
    description:
      'Contact SaveYours in Bloomington, MN for CPR, AED, BLS, and First Aid class questions, or to request an on-site group training quote in the Twin Cities metro.',
  },
  twitter: {
    title: 'Contact SaveYours — Group Training & Class Questions',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
