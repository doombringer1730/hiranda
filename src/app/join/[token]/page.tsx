import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { token } = await params
  const { error: shownError } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Signed out: send them to sign-up with the token in hand. This page is
  // public (see middleware) so the token survives instead of being swallowed
  // by the /login?next= bounce.
  if (!user) redirect(`/signup?token=${encodeURIComponent(token)}`)

  // Already signed in: claim the slot directly rather than dumping them on
  // /signup, which the middleware would just redirect to '/'.
  if (!shownError) {
    const { data: joined, error } = await supabase
      .rpc('accept_invite', { token, new_user_id: user.id })
    if (joined && !error) redirect('/')
    redirect(`/join/${encodeURIComponent(token)}?error=1`)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-stone-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_80%,rgba(120,53,15,0.15),transparent_70%)] pointer-events-none" />
      <div className="w-full max-w-sm text-center">
        <h1 className="font-serif text-4xl text-amber-100 mb-3">Couldn&apos;t join</h1>
        <p className="text-stone-400 text-sm mb-8">
          That invite link is invalid, already used, or you&apos;re already in a space of
          your own. Ask your partner for a fresh link.
        </p>
        <a href="/" className="text-amber-500 hover:text-amber-400 text-sm transition-colors">
          ← Back to Hiranda
        </a>
      </div>
    </main>
  )
}
