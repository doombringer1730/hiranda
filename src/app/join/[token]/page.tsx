import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MessageCircle, Images, Popcorn, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { invitePreview } from '@/lib/invite'
import { acceptInvite } from './actions'
import JoinButton from './join-button'

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const who = (await invitePreview(token))?.name
  const title = who ? `${who} invited you to Hiranda` : 'You’re invited to Hiranda'
  const description = who
    ? `${who} made a little place for the two of you. Free for two — nothing to download.`
    : 'A private little place for the two of you. Free for two — nothing to download.'
  return { title, description, openGraph: { title, description }, twitter: { title, description } }
}

const INSIDE = [
  { icon: MessageCircle, text: 'A chat that’s only the two of you' },
  { icon: Images, text: 'Your memories, pinned up like polaroids' },
  { icon: Popcorn, text: 'Movie nights in sync, even miles apart' },
  { icon: Mail, text: 'Letters to open when you need them' },
]

export default async function JoinPage({ params, searchParams }: Props) {
  const { token } = await params
  const { error: shownError } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Signed in: never join on page load — a link from anywhere could do that.
  // Show what joining means and let them press the button (actions.ts).
  const { data: myCouples } = user
    ? await supabase.from('couple').select('user1_id, user2_id, invite_token').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    : { data: null }
  // Tapping your own link to check it: back to your invite screen.
  if (myCouples?.some(c => c.invite_token === token && c.user1_id === user?.id)) redirect('/invite-partner')
  const partnered = !!myCouples?.some(c => c.user2_id)

  const invite = await invitePreview(token)
  const name = invite?.name ?? null
  const who = name ?? 'Your partner'

  // Used, unknown, or you're already in a space of your own.
  if (shownError || invite === null || partnered) {
    return (
      <Shell>
        <h1 className="font-serif text-4xl text-amber-100 mb-3">{shownError || partnered ? 'Couldn’t join' : 'This invite’s been used'}</h1>
        <p className="text-stone-400 text-sm mb-8">
          {partnered
            ? 'You’re already in a space with your partner, and each person can only be in one.'
            : <>
                {shownError
                  ? 'That invite link is invalid, already used, or you’re already in a space of your own.'
                  : 'Each invite link works once.'}{' '}
                Ask your partner for the link on their invite screen, or start a space of your own and invite them.
              </>}
        </p>
        <div className="flex flex-col gap-3">
          {partnered
            ? <Link href="/" className="w-full bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium rounded-full px-4 py-3.5 transition-colors">Back to your space</Link>
            : <>
                <Link href="/signup" className="w-full bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium rounded-full px-4 py-3.5 transition-colors">Start your own space</Link>
                <Link href="/" className="text-stone-500 hover:text-amber-400 text-sm transition-colors">← Back to Hiranda</Link>
              </>}
        </div>
      </Shell>
    )
  }

  const login = `/login?next=${encodeURIComponent(`/join/${token}`)}`
  return (
    <Shell>
      <div className="mx-auto mb-6 grid h-20 w-20 place-items-center overflow-hidden rounded-full ring-4 ring-stone-900 text-3xl font-semibold text-amber-50"
        style={{ background: invite?.accent ?? 'var(--color-amber-800)' }}>
        {invite?.avatarUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={invite.avatarUrl} alt="" className="h-full w-full object-cover" />
          : (name ?? '♥').slice(0, 1).toUpperCase()}
      </div>
      <p className="text-stone-500 text-[10px] uppercase tracking-[0.3em]">An invitation</p>
      <h1 className="font-serif text-5xl text-amber-50 mt-2 leading-[1.05]">{who} saved you a seat<span className="text-amber-500">.</span></h1>
      <p className="text-stone-400 mt-4">
        Hiranda is a little place just for the two of you{name ? <> — you and {name}</> : null}.
      </p>

      <ul className="mt-8 flex flex-col gap-3 text-left">
        {INSIDE.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 rounded-2xl bg-stone-900/70 border border-stone-800 px-4 py-3">
            <Icon size={18} className="text-amber-400 shrink-0" />
            <span className="text-stone-200 text-sm">{text}</span>
          </li>
        ))}
      </ul>

      {user ? (
        <form action={acceptInvite.bind(null, token)} className="mt-8 flex flex-col gap-3">
          <JoinButton label={`Join ${name ? `${name}’s` : 'their'} space`} />
          <p className="text-stone-500 text-xs">
            {name ?? 'They'} will see what you’ve added so far, and the space you started on your own is replaced.
          </p>
        </form>
      ) : (
        <>
          <div className="mt-8 flex flex-col gap-3">
            <Link href={`/signup?token=${encodeURIComponent(token)}`}
              className="w-full bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium rounded-full px-4 py-3.5 transition-colors">
              Join {name ?? 'them'}
            </Link>
            <Link href={login} className="w-full bg-stone-900 hover:bg-stone-800 border border-stone-800 text-amber-50 font-medium rounded-full px-4 py-3.5 transition-colors">
              I already have an account
            </Link>
          </div>
          <p className="text-stone-500 text-xs mt-5">Free for two. Works in any browser — nothing to download.</p>
          <Link href="/demo" className="inline-block text-stone-500 hover:text-amber-400 text-xs mt-2 underline underline-offset-4 transition-colors">Peek at a demo space first</Link>
        </>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-stone-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_80%,rgba(120,53,15,0.15),transparent_70%)] pointer-events-none" />
      <div className="relative w-full max-w-sm text-center">{children}</div>
    </main>
  )
}
