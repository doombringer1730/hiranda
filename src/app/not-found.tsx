import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p className="text-stone-500 text-[10px] uppercase tracking-[0.3em]">404</p>
      <h1 className="font-serif text-5xl text-amber-50 mt-3 leading-tight">
        Kids, this page<br /><span className="italic text-stone-400">doesn’t exist.</span>
      </h1>
      <p className="text-stone-400 text-sm mt-4 max-w-xs">Wherever you were headed, it’s not here — but the story isn’t over.</p>
      <Link href="/" className="mt-8 rounded-full bg-amber-700 hover:bg-amber-600 px-5 py-2.5 text-sm font-medium text-amber-50 transition-colors">
        Take me home
      </Link>
    </main>
  )
}
