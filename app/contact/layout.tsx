import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact SaveYours — Group Training & Class Questions',
  description:
    'Contact SaveYours in Bloomington, MN for CPR, AED, BLS, and First Aid class questions, or to request an on-site group training quote in the Twin Cities metro.',
  alternates: { canonical: '/contact' },
  openGraph: {
    url: 'https://www.saveyours.net/contact',
    title: 'Contact SaveYours — Group Training & Class Questions',
    description:
      'Contact SaveYours in Bloomington, MN for CPR, AED, BLS, and First Aid class questions, or to request an on-site group training quote in the Twin Cities metro.',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
