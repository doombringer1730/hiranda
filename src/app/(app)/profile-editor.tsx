'use client'

import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { saveProfile } from './profile-actions'
import ImageCropper from './image-cropper'
import { UserCircle, X, Camera, Check, Loader2 } from 'lucide-react'

export type EditableProfile = {
  id: string
  display_name: string
  avatar_url: string | null
  banner_url: string | null
  accent_color: string | null
  bio: string | null
  status_text: string | null
}

const SWATCHES = ['#b45309', '#d97706', '#e11d48', '#f43f5e', '#a855f7', '#6366f1', '#0891b2', '#059669']
const DEFAULT_ACCENT = '#b45309'

function bannerStyle(bannerUrl: string | null, accent: string) {
  if (bannerUrl) return { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  return { background: `linear-gradient(135deg, ${accent}, ${accent}22)` }
}

export default function ProfileEditor({ profile, onClose }: { profile: EditableProfile; onClose: () => void }) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [status, setStatus] = useState(profile.status_text ?? '')
  const [accent, setAccent] = useState(profile.accent_color ?? DEFAULT_ACCENT)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
  const [bannerUrl, setBannerUrl] = useState(profile.banner_url)
  const [crop, setCrop] = useState<{ kind: 'avatar' | 'banner'; file: File } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const avatarInput = useRef<HTMLInputElement>(null)
  const bannerInput = useRef<HTMLInputElement>(null)
  // Portal to <body> so the modal escapes the hub's transformed stacking
  // context (animate-page-in), otherwise the bottom tab bar paints over it.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  function pickFile(kind: 'avatar' | 'banner', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setCrop({ kind, file })
  }

  async function handleCropped(blob: Blob) {
    if (!crop) return
    const kind = crop.kind
    setCrop(null)
    const supabase = createClient()
    const bucket = kind === 'avatar' ? 'avatars' : 'banners'
    const { error: upErr } = await supabase.storage.from(bucket).upload(profile.id, blob, { upsert: true, contentType: 'image/jpeg' })
    if (upErr) { setError(`Upload failed: ${upErr.message}`); return }
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${profile.id}?t=${Date.now()}`
    if (kind === 'avatar') setAvatarUrl(url); else setBannerUrl(url)
  }

  async function save() {
    setSaving(true); setError(null)
    const res = await saveProfile({
      display_name: displayName,
      bio,
      status_text: status,
      accent_color: accent,
      avatar_url: avatarUrl,
      banner_url: bannerUrl,
    })
    setSaving(false)
    if (res?.error) { setError(res.error); return }
    router.refresh()
    onClose()
  }

  if (!mounted) return null

  return createPortal(
    <>
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-5" onClick={onClose}>
        <div
          onClick={e => e.stopPropagation()}
          className="w-full sm:max-w-md bg-stone-900 border border-stone-800 rounded-t-3xl sm:rounded-2xl overflow-hidden max-h-[92vh] flex flex-col animate-page-in"
        >
          {/* Banner + overlapping avatar — both live outside the scroll area so
              the avatar can hang past the banner edge without being clipped. */}
          <div className="relative h-28 w-full shrink-0" style={bannerStyle(bannerUrl, accent)}>
            <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur text-white/90 hover:text-white flex items-center justify-center">
              <X size={16} />
            </button>
            <button
              onClick={() => bannerInput.current?.click()}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/45 backdrop-blur text-white/90 hover:text-white text-xs rounded-full px-3 py-1.5"
            >
              <Camera size={13} /> Banner
            </button>
            <button
              onClick={() => avatarInput.current?.click()}
              className="group absolute -bottom-10 left-5 z-10 w-20 h-20 rounded-full bg-stone-800 border-4 border-stone-900 overflow-hidden flex items-center justify-center"
            >
              {avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                : <UserCircle size={40} className="text-stone-600" />}
              <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={18} className="text-white" />
              </span>
            </button>
          </div>

          <div className="px-5 pt-12 pb-4 flex-1 overflow-y-auto">
            {error && <p className="text-red-400 text-sm bg-red-950/30 rounded-lg px-3 py-2 mb-3">{error}</p>}

            <div className="flex flex-col gap-4">
              <Field label="Display name">
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={60}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-amber-50 focus:outline-none focus:border-amber-700 transition-colors" />
              </Field>

              <Field label="Status">
                <input value={status} onChange={e => setStatus(e.target.value)} maxLength={80} placeholder="what you're up to"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors" />
              </Field>

              <Field label="About">
                <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={190} rows={3} placeholder="a little about you"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors resize-none" />
              </Field>

              <Field label="Accent color">
                <div className="flex items-center gap-2 flex-wrap">
                  {SWATCHES.map(c => (
                    <button key={c} onClick={() => setAccent(c)} aria-label={`accent ${c}`}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${accent.toLowerCase() === c ? 'border-amber-100 scale-110' : 'border-transparent'}`}
                      style={{ background: c }}>
                      {accent.toLowerCase() === c && <Check size={13} className="text-white mx-auto" />}
                    </button>
                  ))}
                  <label className="w-7 h-7 rounded-full border border-stone-700 overflow-hidden relative cursor-pointer" title="custom">
                    <span className="absolute inset-0" style={{ background: 'conic-gradient(red, orange, yellow, lime, cyan, blue, magenta, red)' }} />
                    <input type="color" value={accent} onChange={e => setAccent(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer" />
                  </label>
                </div>
              </Field>

            </div>
          </div>

          {/* Sticky action footer — always reachable on mobile */}
          <div className="shrink-0 border-t border-stone-800 bg-stone-900 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex gap-2">
            <button onClick={onClose} className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl py-3 text-sm transition-colors">Cancel</button>
            <button onClick={save} disabled={saving} className="flex-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 rounded-xl py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />} Save profile
            </button>
          </div>

          <input ref={avatarInput} type="file" accept="image/*" onChange={e => pickFile('avatar', e)} className="hidden" />
          <input ref={bannerInput} type="file" accept="image/*" onChange={e => pickFile('banner', e)} className="hidden" />
        </div>
      </div>

      {crop && (
        <ImageCropper
          file={crop.file}
          aspect={crop.kind === 'avatar' ? 1 : 3}
          outWidth={crop.kind === 'avatar' ? 512 : 1200}
          title={crop.kind === 'avatar' ? 'Crop your avatar' : 'Crop your banner'}
          onCancel={() => setCrop(null)}
          onApply={handleCropped}
        />
      )}
    </>,
    document.body,
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-stone-400 text-xs uppercase tracking-widest">{label}</label>
      {children}
    </div>
  )
}
