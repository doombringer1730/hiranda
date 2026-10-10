import { getOrCreateCouple, disconnectSpotify } from './actions'
import { headers } from 'next/headers'
import Link from 'next/link'
import SettingsClient from './settings-client'
import { NotificationSettings } from '@/components/pwa'
import QuietSettings from '@/components/quiet-settings'
import { logout } from '@/app/(auth)/actions'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/page-header'
import AccountSection from './account-section'
import MfaSettings from '@/components/mfa-settings'
import { hasPlus } from '@/lib/plus'
import { Sparkles } from 'lucide-react'
import BuyMeCoffee from '@/components/buy-me-coffee'

export default async function SettingsPage() {
  const plus = await hasPlus()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username, avatar_url, spotify_display_name')
    .eq('id', user!.id)
    .single()

  const couple = await getOrCreateCouple()
  const theme = (couple as { theme?: string })?.theme ?? 'coffee'
  const c = couple as { user1_id?: string; user2_id?: string | null } | null
  const partnerId = c ? (c.user1_id === user!.id ? c.user2_id : c.user1_id) : null
  const { data: partnerProfile } = partnerId
    ? await supabase.from('profiles').select('display_name').eq('id', partnerId).maybeSingle()
    : { data: null }

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const inviteLink = `${protocol}://${host}/join/${couple?.invite_token}`

  return (
    <div className="px-4 pt-8 max-w-lg mx-auto pb-12">
      <PageHeader eyebrow="Your little corner" title="Settings" className="mb-8" />

      <div className="flex flex-col gap-4">

        {/* Plus */}
        <Link href="/plus" className="flex items-center gap-3 rounded-2xl border border-amber-800/40 bg-amber-950/20 p-5 hover:border-amber-700/60 transition-colors">
          <Sparkles size={18} className="text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-amber-100 font-medium">Hiranda Plus</p>
            <p className="text-stone-400 text-sm">{plus ? 'Active for you both — thank you 💛' : 'No ads, your own theme, the Deepest deck and more — one plan for both of you.'}</p>
          </div>
          <span className="text-stone-500 text-sm">›</span>
        </Link>

        {/* Notifications */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
          <h3 className="text-amber-200 font-medium mb-1">Notifications</h3>
          <p className="text-stone-500 text-sm mb-4">A ping when your partner answers, plays a move, or adds something. Set per device.</p>
          <NotificationSettings />
          <div className="h-px bg-stone-800 my-5" />
          <QuietSettings />
        </section>

        {/* Theme */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
          <h3 className="text-amber-200 font-medium mb-1">Theme</h3>
          <p className="text-stone-500 text-sm mb-4">Shared with your partner — you both see the same one.</p>
          <SettingsClient type="theme" currentTheme={theme} plus={plus} />
        </section>

        {/* Profile — photo, banner, colour now live on your profile */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
          <h3 className="text-amber-200 font-medium mb-1">Profile</h3>
          <p className="text-stone-500 text-sm mb-4">Your photo, banner, colour, and bio — edit them on your profile.</p>
          <Link
            href={profile?.username ? `/profile/${profile.username}` : '/'}
            className="inline-flex items-center gap-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm rounded-xl px-4 py-2.5 transition-colors"
          >
            Edit your profile →
          </Link>
        </section>

        {/* Username */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
          <h3 className="text-amber-200 font-medium mb-1">Username</h3>
          <p className="text-stone-500 text-sm mb-4">Your public profile URL — set once, can’t be changed.</p>
          <SettingsClient type="username" username={profile?.username ?? null} />
        </section>

        {/* Your name */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
          <h3 className="text-amber-200 font-medium mb-1">Your name</h3>
          <p className="text-stone-500 text-sm mb-4">Shown on things you add across the app.</p>
          <SettingsClient type="name" displayName={profile?.display_name ?? ''} />
        </section>

        {/* Invite link */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
          <h3 className="text-amber-200 font-medium mb-1">Invite link</h3>
          <p className="text-stone-500 text-sm mb-4">
            {couple?.user2_id
              ? 'Your partner has joined. You\'re linked.'
              : 'Share this link with your partner so they can join your space.'}
          </p>
          {!couple?.user2_id && (
            <SettingsClient type="invite" inviteLink={inviteLink} />
          )}
          {couple?.user2_id && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-green-400 text-sm">Linked</span>
            </div>
          )}
        </section>

        {/* Relationship timer */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
          <h3 className="text-amber-200 font-medium mb-1">Relationship timer</h3>
          <p className="text-stone-500 text-sm mb-4">
            Shows your days together in the sidebar on desktop. On phones, they’re under your greeting on Home.
          </p>
          <SettingsClient
            type="timer"
            showTimer={couple?.show_timer ?? true}
            togetherSince={couple?.together_since ?? ''}
          />
        </section>

        {/* Spotify */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
          <h3 className="text-amber-200 font-medium mb-1">Spotify</h3>
          <p className="text-stone-500 text-sm mb-4">
            Share what you&apos;re listening to with your partner — shows live in their sidebar.
          </p>
          {profile?.spotify_display_name ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-green-400 text-sm">{profile.spotify_display_name}</span>
              </div>
              <form action={disconnectSpotify}>
                <button type="submit" className="text-stone-500 hover:text-red-400 text-sm transition-colors">
                  Disconnect
                </button>
              </form>
            </div>
          ) : (
            <a
              href="/api/spotify/connect"
              className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
            >
              Connect Spotify
            </a>
          )}
        </section>

        {/* Two-factor */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
          <h3 className="text-amber-200 font-medium mb-1">Two-factor login</h3>
          <p className="text-stone-500 text-sm mb-4">Ask for a code from an authenticator app when you sign in, so a password alone can’t open your space.</p>
          <MfaSettings />
        </section>

        {/* Your data */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
          <h3 className="text-amber-200 font-medium mb-1">Your data</h3>
          <p className="text-stone-500 text-sm mb-4">It’s yours. Take a full copy any time, or leave for good.</p>
          <AccountSection partnerName={partnerProfile?.display_name?.split(' ')[0] ?? null} />
          <p className="text-stone-600 text-xs mt-4">
            <a href="/support" className="hover:text-stone-400">Help &amp; support</a> · <a href="/privacy" className="hover:text-stone-400">Privacy policy</a> · <a href="/terms" className="hover:text-stone-400">Terms</a>
          </p>
        </section>

        <BuyMeCoffee />

        {/* Sign out */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
          <h3 className="text-amber-200 font-medium mb-3">Account</h3>
          <form action={logout}>
            <button type="submit"
              className="flex items-center gap-2 text-sm text-stone-400 hover:text-red-400 transition-colors">
              <LogOut size={16} /> Sign out
            </button>
          </form>
        </section>

      </div>
    </div>
  )
}
