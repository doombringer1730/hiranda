import { MetadataRoute } from 'next'

// Hiranda is a fully private couples app — no page should be crawled or indexed.
// This generates GET /robots.txt via the Next.js Metadata Route API.
// The route is exempt from the auth middleware (static file, no cookies needed).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  }
}
