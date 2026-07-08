import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { UserCircle, ArrowLeft, Heart } from 'lucide-react'
import EditProfileButton from './edit-profile-button'

const DEFAULT_ACCENT = '#b45309'

function formatTogetherSince(dateStr: string): { label: string; duration: string } {
  const date = new Date(dateStr)
  const now = new Date()
  const label = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  let years = now.getFullYear() - date.getFullYear()
  let months = now.getMonth() - date.getMonth()
  if (months < 0) { months += 12; years-- }
  const parts: string[] = []
  if (years > 0) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`)
  if (months > 0) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`)
  if (parts.length === 0) parts.push('just started')
  return { label, duration: parts.join(', ') }
}

function bannerStyle(bannerUrl: string | null, accent: string) {
  if (bannerUrl) return { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  return { background: `linear-gradient(135deg, ${accent}, ${accent}22 70%, transparent)` }
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url, banner_url, accent_color, bio, status_text')
    .eq('username', username)
    .maybeSingle()

  if (!profile) notFound()

  const { data: couple } = await supabase
    .from('couple')
    .select('user1_id, user2_id, together_since')
    .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`)
    .maybeSingle()

  const partnerId = couple
    ? couple.user1_id === profile.id ? couple.user2_id : couple.user1_id
    : null

  const { data: partner } = partnerId
    ? await supabase.from('profiles').select('display_name, username, avatar_url').eq('id', partnerId).maybeSingle()
    : { data: null }

  const together = couple?.together_since ? formatTogetherSince(couple.together_since) : null
  const accent = profile.accent_color || DEFAULT_ACCENT
  const isSelf = profile.id === user.id

  return (
    <main className="min-h-screen bg-stone-950 pb-16">
      <div className="max-w-sm mx-auto px-4 pt-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-300 text-sm transition-colors mb-4">
          <ArrowLeft size={15} /> Back
        </Link>
      </div>

      <div className="max-w-sm mx-auto px-4">
        {/* Discord-style profile card */}
        <div className="rounded-3xl bg-stone-900/70 border border-stone-800 overflow-hidden">
          <div className="h-28 w-full" style={bannerStyle(profile.banner_url, accent)} />
          <div className="px-5 pb-6">
            <div className="flex items-end justify-between -mt-12 mb-3">
              <div className="w-24 h-24 rounded-full bg-stone-800 border-4 border-stone-900 overflow-hidden flex items-center justify-center">
                {profile.avatar_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
                  : <UserCircle size={48} className="text-stone-600" />}
              </div>
              {isSelf && (
                <EditProfileButton profile={{
                  id: profile.id, display_name: profile.display_name, avatar_url: profile.avatar_url,
                  banner_url: profile.banner_url, accent_color: profile.accent_color,
                  bio: profile.bio, status_text: profile.status_text,
                }} />
              )}
            </div>

            <h1 className="font-serif text-2xl text-amber-100">{profile.display_name}</h1>
            <p className="text-stone-500 text-sm">@{profile.username}</p>

            {profile.status_text && (
              <p className="text-stone-300 text-sm mt-3 italic">&ldquo;{profile.status_text}&rdquo;</p>
            )}

            {profile.bio && (
              <div className="mt-4">
                <p className="text-stone-500 text-[10px] uppercase tracking-widest mb-1">About</p>
                <p className="text-stone-300 text-sm whitespace-pre-line">{profile.bio}</p>
              </div>
            )}
          </div>
        </div>

        {/* Together since */}
        {together && (
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 mt-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Heart size={14} style={{ color: accent }} />
              <p className="text-stone-400 text-xs uppercase tracking-widest">Together since</p>
            </div>
            <p className="text-amber-100 font-medium">{together.label}</p>
            <p className="text-stone-500 text-sm mt-0.5">{together.duration}</p>
          </div>
        )}

        {/* Partner */}
        {partner && (
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 mt-4">
            <p className="text-stone-500 text-xs uppercase tracking-widest mb-4">Partner</p>
            {partner.username ? (
              <Link href={`/profile/${partner.username}`} className="flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-full bg-stone-800 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {partner.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={partner.avatar_url} alt={partner.display_name} className="w-full h-full object-cover" />
                    : <UserCircle size={20} className="text-stone-600" />}
                </div>
                <div>
                  <p className="text-amber-100 group-hover:text-amber-300 transition-colors">{partner.display_name}</p>
                  <p className="text-stone-500 text-xs">@{partner.username}</p>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-stone-800 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {partner.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={partner.avatar_url} alt={partner.display_name} className="w-full h-full object-cover" />
                    : <UserCircle size={20} className="text-stone-600" />}
                </div>
                <p className="text-amber-100">{partner.display_name}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
