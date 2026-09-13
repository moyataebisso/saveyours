import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CLASS_INFO, getClassBySlug } from '@/lib/class-info';
import { ClassPageClient } from './class-page-client';

export function generateStaticParams() {
  return CLASS_INFO.map(c => ({ slug: c.slug }));
}

// Per-page metadata avoids the root-inheritance bug fixed in 802aa1c —
// canonical, og:url, og:title, twitter.title, and title.absolute are all set
// on every child so nothing bleeds through from the root layout.
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const info = getClassBySlug(slug);
  if (!info) return {};

  const title = `${info.displayName} Certification in Bloomington, MN | SaveYours`;
  const description = info.summary;
  const canonicalPath = `/classes/${info.slug}`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      url: canonicalPath,
      title,
      description,
    },
    twitter: {
      title,
    },
  };
}

export default async function ClassSlugPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const info = getClassBySlug(slug);
  if (!info) notFound();
  return <ClassPageClient info={info} />;
}
