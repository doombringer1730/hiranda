import Nav from '@/components/nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-950">
      <Nav />
      {/* Desktop: offset for sidebar. Mobile: offset for bottom nav */}
      <main className="md:ml-56 pb-24 md:pb-8 min-h-screen">
        {children}
      </main>
    </div>
  )
}
