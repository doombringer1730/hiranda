import { MetadataRoute } from 'next'

// Hiranda is a private couples app — nothing behind sign-in is crawled. The
// welcome tour (/login) and the example-data demo space (/demo) are the public
// front door, so those two are allowed (the longer rule wins over `/`).
// This generates GET /robots.txt via the Next.js Metadata Route API.
// The route is exempt from the auth middleware (static file, no cookies needed).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/demo', '/login'],
      disallow: '/',
    },
  }
}
