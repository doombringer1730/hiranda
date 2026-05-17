import Nav from '@/components/nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-950">
      <Nav />
      {/* Desktop: offset for sidebar. Mobile: offset for bottom nav */}
      <main className="md:ml-56 pt-16 md:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  )
}
