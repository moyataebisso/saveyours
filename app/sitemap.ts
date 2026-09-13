import type { MetadataRoute } from 'next';
import { CLASS_INFO } from '@/lib/class-info';

const SITE = 'https://www.saveyours.net';

// Per-session URLs are excluded — sessions come and go and would create a
// churn of dead entries. Admin, auth, cart, and dashboard are excluded by
// intent (see robots.ts). Class landing pages (/classes/[slug]) come from
// CLASS_INFO so they can't drift from what's actually rendered.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${SITE}/classes`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    ...CLASS_INFO.map(c => ({
      url: `${SITE}/classes/${c.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
    { url: `${SITE}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE}/policies`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE}/policies/refunds`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
  ];
}
