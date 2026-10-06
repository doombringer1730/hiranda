import { getOrCreateCouple, disconnectSpotify } from './actions'
import { headers } from 'next/headers'
import Link from 'next/link'
import SettingsClient from './settings-client'
import { NotificationSettings } from '@/components/pwa'
import TheaterGate from './theater-gate'
import { logout } from '@/app/(auth)/actions'
import { LogOut, Film } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getTheaterState } from '@/lib/theater'
import PageHeader from '@/components/page-header'
import AccountSection from './account-section'
import MfaSettings from '@/components/mfa-settings'

export default async function SettingsPage() {
  const theater = await getTheaterState()
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

        {/* Notifications */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
          <h3 className="text-amber-200 font-medium mb-1">Notifications</h3>
          <p className="text-stone-500 text-sm mb-4">A ping when your partner answers, plays a move, or adds something. Set per device.</p>
          <NotificationSettings />
        </section>

        {/* Theme */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
          <h3 className="text-amber-200 font-medium mb-1">Theme</h3>
          <p className="text-stone-500 text-sm mb-4">Shared with your partner — you both see the same one.</p>
          <SettingsClient type="theme" currentTheme={theme} />
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
            Shows a live “together” counter in the sidebar on desktop. On phones, your days together live on Home.
          </p>
          <SettingsClient
            type="timer"
            showTimer={couple?.show_timer ?? true}
            togetherSince={couple?.together_since ?? ''}
          />
        </section>

        {/* Theater — passcode-gated watch/sync + streaming sources */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
          <h3 className="text-amber-200 font-medium mb-1 flex items-center gap-2"><Film size={16} className="text-indigo-400" /> Theater</h3>
          <p className="text-stone-500 text-sm mb-4">
            Watch-together and its streaming sources live behind a shared passcode. {theater.hasPasscode ? 'Enter it to unlock for this session.' : 'Set a passcode to enable it.'}
          </p>
          <TheaterGate hasPasscode={theater.hasPasscode} unlocked={theater.unlocked} />
        </section>

        {/* Streaming sources — only while the Theater is unlocked */}
        {theater.unlocked && (
          <>
            <section className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
              <h3 className="text-amber-200 font-medium mb-1">Jellyfin</h3>
              <p className="text-stone-500 text-sm mb-4">
                Connect your Raspberry Pi media server to browse your library from the Watch page.
              </p>
              <SettingsClient type="jellyfin" jellyfinUrl={couple?.jellyfin_url ?? ''} jellyfinApiKey={couple?.jellyfin_api_key ?? ''} />
            </section>

            <section className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
              <h3 className="text-amber-200 font-medium mb-1">Real-Debrid</h3>
              <p className="text-stone-500 text-sm mb-4">Search and stream movies and TV shows from the Watch page.</p>
              <SettingsClient type="realdebrid" rdApiKey={couple?.real_debrid_api_key ?? ''} />
            </section>

            <section className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
              <h3 className="text-amber-200 font-medium mb-1">TorBox</h3>
              <p className="text-stone-500 text-sm mb-4">Optional second debrid service — streams from TorBox are shown alongside Real-Debrid for more coverage.</p>
              <SettingsClient type="torbox" apiKey={couple?.torbox_api_key ?? ''} />
            </section>
          </>
        )}

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
