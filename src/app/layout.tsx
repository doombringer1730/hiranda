import type { Metadata, Viewport } from "next";
import { Caveat, Instrument_Serif, Inter } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { ServiceWorkerRegister } from "@/components/pwa";
import { NativeBridge } from "@/components/native-bridge";
import PressFeedback from "@/components/press-feedback";
import "./globals.css";

const serif = Instrument_Serif({
  variable: "--font-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

// Handwriting for the personal bits — notes, captions, answers — so the
// app feels written by the two of you, not typeset by a machine.
const hand = Caveat({
  variable: "--font-hand",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // metadataBase is required for Next.js to construct absolute URLs for OG images,
  // canonical links, and Twitter cards. Without it Next.js falls back to
  // "http://localhost:3000" and Google reports malformed canonical/OG URLs.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://hiranda.com'
  ),
  title: "Hiranda",
  description: "Our little place on the internet.",
  // Hiranda is a private app — prevent Google from indexing any page.
  robots: { index: false, follow: false },
  // Home-screen install on iPhone (the web manifest covers everyone else).
  appleWebApp: { capable: true, title: "Hiranda", statusBarStyle: "black" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1a1008",
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let theme = 'coffee'
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: couple } = await supabase
        .from('couple')
        .select('theme')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('user2_id', { nullsFirst: false }).limit(1)
        .maybeSingle()
      theme = couple?.theme ?? 'coffee'
    }
  } catch {
    // no-op — fall back to default theme
  }

  return (
    <html
      lang="en"
      data-theme={theme}
      data-scroll-behavior="smooth"
      className={`${serif.variable} ${inter.variable} ${hand.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-stone-950 text-amber-50 antialiased">
        {children}
        <ServiceWorkerRegister />
        <NativeBridge />
        <PressFeedback />
      </body>
    </html>
  );
}
