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

const SITE = 'https://www.saveyours.net';

export default async function ClassSlugPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const info = getClassBySlug(slug);
  if (!info) notFound();

  // Course schema — provider references the LocalBusiness in the root layout
  // by @id rather than duplicating its fields. Any address/name/url change
  // in the root layout automatically propagates via the reference.
  const courseJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: info.displayName,
    description: info.summary,
    provider: { '@id': `${SITE}/#business` },
    offers: {
      '@type': 'Offer',
      price: info.price,
      priceCurrency: 'USD',
      url: `${SITE}/classes/${info.slug}`,
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Classes', item: `${SITE}/classes` },
      { '@type': 'ListItem', position: 3, name: info.displayName, item: `${SITE}/classes/${info.slug}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ClassPageClient info={info} />
    </>
  );
}
