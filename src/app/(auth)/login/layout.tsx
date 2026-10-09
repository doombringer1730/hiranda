import type { Metadata } from 'next'

// The welcome tour doubles as Hiranda's front page, so it's indexable and
// carries a real description; everything behind sign-in stays noindex.
export const metadata: Metadata = {
  title: 'Hiranda — a private little place for the two of you',
  description: 'A shared space for couples: one question a day, letters for the hard days, a jar of date ideas, watch together in sync. Free for two.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Hiranda — a private little place for the two of you',
    description: 'One question a day, letters for the hard days, a jar of date ideas, watch together in sync. Free for two.',
    url: '/login',
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
