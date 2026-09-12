import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    absolute: 'CPR, BLS & First Aid Classes — Schedule & Registration | SaveYours',
  },
  description:
    'Browse upcoming CPR/AED/First Aid and BLS classes in Bloomington, MN. Blended format — online portion completed first, then in-person skills check.',
  alternates: { canonical: '/classes' },
  openGraph: {
    url: '/classes',
    title: 'CPR, BLS & First Aid Classes — Schedule & Registration | SaveYours',
    description:
      'Browse upcoming CPR/AED/First Aid and BLS classes in Bloomington, MN. Blended format — online portion completed first, then in-person skills check.',
  },
  twitter: {
    title: 'CPR, BLS & First Aid Classes — Schedule & Registration | SaveYours',
  },
};

export default function ClassesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
