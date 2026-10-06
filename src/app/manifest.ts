import type { MetadataRoute } from 'next'

// Makes Hiranda installable ("Add to Home Screen"). Served at
// /manifest.webmanifest — excluded from the auth middleware because browsers
// fetch it without cookies.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Hiranda',
    short_name: 'Hiranda',
    description: 'Our little place on the internet.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#120c08',
    theme_color: '#1a1008',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
