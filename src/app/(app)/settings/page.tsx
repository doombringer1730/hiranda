import { getOrCreateCouple } from './actions'
import { headers } from 'next/headers'
import SettingsClient from './settings-client'
import { logout } from '@/app/(auth)/actions'
import { LogOut } from 'lucide-react'

export default async function SettingsPage() {
  const couple = await getOrCreateCouple()

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const inviteLink = `${protocol}://${host}/join/${couple?.invite_token}`

  return (
    <div className="px-4 pt-8 max-w-lg mx-auto pb-12">
      <h2 className="font-serif text-3xl text-amber-100 mb-8">Settings</h2>

      <div className="flex flex-col gap-4">

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
            Shows a live counter in the top corner of the app.
          </p>
          <SettingsClient
            type="timer"
            showTimer={couple?.show_timer ?? true}
            togetherSince={couple?.together_since ?? ''}
          />
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
