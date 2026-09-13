import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CLASS_INFO, getClassBySlug, type ClassInfo } from '@/lib/class-info';
import { supabase } from '@/lib/supabase';
import { ClassPageClient } from './class-page-client';
import type { SessionRow } from './session-row';

// ISR: regenerate every 5 minutes. Sessions change on admin action, not by
// the second — 5 minutes is short enough that a newly scheduled class shows
// up quickly, long enough to serve most requests from cache and stay up if
// Supabase blips (the last-cached HTML continues to serve). Never renders
// an error page: on fetch failure we ship the empty state.
export const revalidate = 300;

export function generateStaticParams() {
  return CLASS_INFO.map(c => ({ slug: c.slug }));
}

async function fetchUpcomingForClass(info: ClassInfo): Promise<SessionRow[]> {
  const todayIso = new Date().toISOString().split('T')[0];
  try {
    const { data, error } = await supabase
      .from('class_sessions')
      .select('*, class:classes(*)')
      .eq('status', 'scheduled')
      .gte('date', todayIso)
      .order('date', { ascending: true });
    if (error) {
      console.error('[CLASS_PAGE] Session fetch error:', error);
      return [];
    }
    // PostgREST doesn't cleanly filter across a joined table, so we narrow
    // by dbType or dbName in JS. The total scheduled-session count is small
    // (single digits) so this is cheap.
    return (data as SessionRow[]).filter(
      s => s.class?.type === info.dbType || s.class?.name === info.dbName
    );
  } catch (err) {
    console.error('[CLASS_PAGE] Session fetch threw:', err);
    return [];
  }
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

  const upcoming = await fetchUpcomingForClass(info);

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
      <ClassPageClient info={info} upcoming={upcoming} />
    </>
  );
}
