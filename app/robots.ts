import type { MetadataRoute } from 'next';

// LLM crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) get the
// same allow rules as every other agent. They're listed explicitly so a
// future policy change is a one-line edit, not a hunt.
export default function robots(): MetadataRoute.Robots {
  const disallow = ['/admin', '/api', '/cart', '/checkout', '/login', '/register', '/dashboard'];
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      { userAgent: 'GPTBot', allow: '/', disallow },
      { userAgent: 'ClaudeBot', allow: '/', disallow },
      { userAgent: 'PerplexityBot', allow: '/', disallow },
      { userAgent: 'Google-Extended', allow: '/', disallow },
    ],
    sitemap: 'https://www.saveyours.net/sitemap.xml',
  };
}
