import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-serif",
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
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://hiranda-616i.vercel.app'
  ),
  title: "Hiranda",
  description: "Our little place on the internet.",
  // Hiranda is a private app — prevent Google from indexing any page.
  robots: { index: false, follow: false },
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
      className={`${playfair.variable} ${inter.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-stone-950 text-amber-50 antialiased">
        {children}
      </body>
    </html>
  );
}
