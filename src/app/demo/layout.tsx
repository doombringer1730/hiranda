import type { Metadata } from 'next'

// The demo is the one page strangers can explore without an account, so it's
// the link we share — give it its own preview and let search engines in.
export const metadata: Metadata = {
  title: 'Hiranda demo — look around Sam & Riley’s space',
  description: 'Try Hiranda without signing up: answer the daily question, open a letter, pull from the date jar. A private little place for the two of you.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Look around a Hiranda space',
    description: 'A private little place for the two of you. Try the demo, no account needed.',
    url: '/demo',
  },
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children
}
