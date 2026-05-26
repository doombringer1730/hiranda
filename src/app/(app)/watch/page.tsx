'use client'

import { useEffect, useRef, useState } from 'react'
import { createWatchSession, createWatchSessionFromUrl, createWatchSessionLocal, getCoupleData, updateWatchSession, deleteWatchSession } from './actions'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Play, Film, Plus, Loader2, X, Upload, Link2, HardDrive, Library, Search, MoreHorizontal, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import JellyfinBrowser, { JellyfinNotConfigured } from './jellyfin-browser'
import RealDebridBrowser, { RealDebridNotConfigured } from './real-debrid-browser'

const PLATFORM_LABELS: Record<string, string> = {
  netflix: 'Netflix', youtube: 'YouTube', disney: 'Disney+',
  prime: 'Prime Video', max: 'Max', hulu: 'Hulu',
  appletv: 'Apple TV+', paramount: 'Paramount+',
}

type WatchSession = { id: string; title: string; created_at: string; source_type: string | null; thumbnail_url: string | null; platform: string | null }
type Tab = 'upload' | 'url' | 'local' | 'jellyfin' | 'stream'

export default function WatchPage() {
  const [sessions, setSessions] = useState<WatchSession[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingSession, setEditingSession] = useState<WatchSession | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editThumbnail, setEditThumbnail] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [tab, setTab] = useState<Tab>('upload')
  const [jellyfinUrl, setJellyfinUrl] = useState('')
  const [jellyfinApiKey, setJellyfinApiKey] = useState('')
  const [rdApiKey, setRdApiKey] = useState('')
  const [tbApiKey, setTbApiKey] = useState('')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [localFile, setLocalFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('watch_sessions')
      .select('id, title, created_at, source_type, thumbnail_url, platform')
      .order('created_at', { ascending: false })
      .then(({ data }) => setSessions(data ?? []))

    getCoupleData().then(data => {
      if (data?.jellyfin_url) setJellyfinUrl(data.jellyfin_url)
      if (data?.jellyfin_api_key) setJellyfinApiKey(data.jellyfin_api_key)
      if (data?.real_debrid_api_key) setRdApiKey(data.real_debrid_api_key)
      if (data?.torbox_api_key) setTbApiKey(data.torbox_api_key)
    })
  }, [])

  function openEdit(s: WatchSession) {
    setEditingSession(s)
    setEditTitle(s.title)
    setEditThumbnail(s.thumbnail_url ?? '')
    setShowDeleteConfirm(false)
  }

  function closeEdit() {
    setEditingSession(null)
    setShowDeleteConfirm(false)
  }

  async function handleSave() {
    if (!editingSession || !editTitle.trim()) return
    setSaving(true)
    await updateWatchSession(editingSession.id, editTitle, editThumbnail || null)
    setSessions(prev => prev.map(s =>
      s.id === editingSession.id
        ? { ...s, title: editTitle.trim(), thumbnail_url: editThumbnail || null }
        : s
    ))
    setSaving(false)
    closeEdit()
  }

  async function handleDelete() {
    if (!editingSession) return
    setDeleting(true)
    await deleteWatchSession(editingSession.id, null)
    setSessions(prev => prev.filter(s => s.id !== editingSession.id))
    setDeleting(false)
    closeEdit()
  }

  function reset() {
    setTitle(''); setUrl(''); setFile(null); setLocalFile(null)
    setError(null); setProgress(null); setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (tab === 'jellyfin') return
    if (!title.trim()) return
    setUploading(true); setError(null)

    let result: { sessionId?: string; error?: string } | undefined

    if (tab === 'url') {
      if (!url.trim()) { setError('Paste a video URL'); setUploading(false); return }
      result = await createWatchSessionFromUrl(title.trim(), url.trim())

    } else if (tab === 'local') {
      if (!localFile) { setError('Select a file first'); setUploading(false); return }
      result = await createWatchSessionLocal(title.trim(), localFile.name)

    } else {
      if (!file) { setError('Select a file to upload'); setUploading(false); return }
      setProgress(0)

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not logged in'); setUploading(false); return }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Not logged in'); setUploading(false); return }

      const ext = file.name.split('.').pop() ?? 'mp4'
      const path = `${user.id}/${Date.now()}.${ext}`
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

      await new Promise<void>((resolve, reject) => {
        const { Upload } = require('tus-js-client')
        new Upload(file, {
          endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: { authorization: `Bearer ${session.access_token}`, 'x-upsert': 'true' },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          metadata: { bucketName: 'videos', objectName: path, contentType: file.type, cacheControl: '3600' },
          chunkSize: 6 * 1024 * 1024,
          onError: reject,
          onProgress: (up: number, tot: number) => setProgress(Math.round((up / tot) * 100)),
          onSuccess: resolve,
        }).start()
      }).catch((err) => {
        setError(err?.message ?? 'Upload failed'); setUploading(false); setProgress(null)
        throw err
      })

      result = await createWatchSession(title.trim(), path)
    }

    if (result && 'error' in result && result.error) {
      setError(result.error); setUploading(false); setProgress(null); return
    }
    if (result?.sessionId) router.push(`/watch/${result.sessionId}`)
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'upload',   label: 'Upload',   icon: <Upload size={14} /> },
    { id: 'url',      label: 'Link / Pi', icon: <Link2 size={14} /> },
    { id: 'local',    label: 'Local',    icon: <HardDrive size={14} /> },
    { id: 'jellyfin', label: 'Library',  icon: <Library size={14} /> },
    { id: 'stream',   label: 'Search',   icon: <Search size={14} /> },
  ]

  return (
    <div className="px-4 pt-8 max-w-2xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-serif text-3xl text-amber-100">Watch Together</h2>
        <button
          onClick={() => { setShowForm(v => !v); reset() }}
          className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'New session'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-stone-900/80 border border-stone-800/80 rounded-2xl p-5 mb-8 flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-stone-950 rounded-xl p-1">
            {tabs.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setTab(t.id); setError(null) }}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-all ${
                  tab === t.id ? 'bg-amber-700 text-amber-50' : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {error && <p className="text-red-400 text-sm bg-red-950/30 rounded-xl px-4 py-3">{error}</p>}

          {tab !== 'jellyfin' && (
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
              placeholder="Title"
            />
          )}

          {tab === 'upload' && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-stone-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-amber-900/40 file:text-amber-300 file:text-sm cursor-pointer"
              />
              {file && <p className="text-stone-500 text-xs -mt-2">{file.name} — {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
              {uploading && progress !== null && (
                <div className="flex flex-col gap-1.5">
                  <div className="w-full bg-stone-800 rounded-full h-2 overflow-hidden">
                    <div className="bg-amber-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-stone-500 text-xs text-right">{progress}%</p>
                </div>
              )}
            </>
          )}

          {tab === 'url' && (
            <div className="flex flex-col gap-1.5">
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
                placeholder="https://… (MP4, MKV, M3U8, Jellyfin link…)"
              />
              <p className="text-stone-600 text-xs px-1">Works with direct video links and HLS streams from your Raspberry Pi.</p>
            </div>
          )}

          {tab === 'local' && (
            <div className="flex flex-col gap-1.5">
              <input
                type="file"
                accept="video/*"
                onChange={e => setLocalFile(e.target.files?.[0] ?? null)}
                className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-stone-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-amber-900/40 file:text-amber-300 file:text-sm cursor-pointer"
              />
              {localFile && <p className="text-stone-500 text-xs -mt-2">{localFile.name} — plays locally, nothing uploaded</p>}
              <p className="text-stone-600 text-xs px-1">Play from your device or USB drive. Your partner selects their copy on their device.</p>
            </div>
          )}

          {tab === 'jellyfin' && (
            jellyfinUrl && jellyfinApiKey
              ? <JellyfinBrowser jellyfinUrl={jellyfinUrl} jellyfinApiKey={jellyfinApiKey} />
              : <JellyfinNotConfigured />
          )}

          {tab === 'stream' && (
            rdApiKey
              ? <RealDebridBrowser rdApiKey={rdApiKey} torBoxApiKey={tbApiKey} />
              : <RealDebridNotConfigured />
          )}

          {tab !== 'jellyfin' && tab !== 'stream' && (
            <button
              type="submit"
              disabled={uploading || !title.trim()}
              className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2"
            >
              {uploading
                ? <><Loader2 size={16} className="animate-spin" /> {progress !== null ? `Uploading ${progress}%…` : 'Starting…'}</>
                : 'Start watching'}
            </button>
          )}
        </form>
      )}

      {sessions.length === 0 && !showForm && (
        <div className="text-center py-24">
          <Film size={40} className="mx-auto text-stone-700 mb-4" />
          <p className="text-stone-500">No sessions yet. Start one above.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {sessions.map((s) => {
          const isParty = s.source_type === 'party'
          const href = isParty ? `/party/${s.id}` : `/watch/${s.id}`
          const platformLabel = isParty && s.platform ? (PLATFORM_LABELS[s.platform] ?? s.platform) : null

          return (
            <div key={s.id} className="relative group">
              <Link href={href}
                className="flex items-center bg-stone-900/80 border border-stone-800/80 hover:border-amber-800/50 rounded-xl overflow-hidden transition-colors card-glow"
              >
                {s.thumbnail_url
                  ? <img src={s.thumbnail_url} alt={s.title} className="w-14 h-20 object-cover flex-shrink-0" />
                  : <div className="w-14 h-20 bg-stone-800 flex items-center justify-center flex-shrink-0">
                      {isParty
                        ? <span className="text-lg">🎬</span>
                        : <Play size={18} className="text-amber-500" />
                      }
                    </div>
                }
                <div className="flex-1 min-w-0 py-3 pl-4 pr-10">
                  <p className="text-amber-100 group-hover:text-amber-300 transition-colors truncate">{s.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-stone-500 text-xs">
                      {new Date(s.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    {isParty && platformLabel && (
                      <span className="text-xs bg-amber-950/50 text-amber-600 border border-amber-900/50 px-2 py-0.5 rounded-full">
                        {platformLabel}
                      </span>
                    )}
                    {!isParty && s.source_type && s.source_type !== 'upload' && (
                      <span className="text-xs bg-stone-800 text-stone-500 px-2 py-0.5 rounded-full">
                        {s.source_type === 'url' ? 'Link' : 'Local'}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
              <button
                onClick={() => openEdit(s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-stone-600 hover:text-stone-300 transition-colors"
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Edit / delete sheet — single bottom sheet, two views */}
      {editingSession && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={closeEdit} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-stone-900 border-t border-stone-800 rounded-t-2xl px-5 pt-5 pb-[max(2.5rem,env(safe-area-inset-bottom,2.5rem))] md:max-w-lg md:left-1/2 md:-translate-x-1/2 md:rounded-2xl md:bottom-8 md:border md:pb-5">

            {!showDeleteConfirm ? (
              /* ── Edit view ── */
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-amber-100 font-medium">Edit session</h3>
                  <button onClick={closeEdit} className="text-stone-500 hover:text-stone-300 transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <div className="flex flex-col gap-3 mb-6">
                  <div>
                    <label className="text-stone-400 text-xs uppercase tracking-widest mb-1.5 block">Title</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-700 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-stone-400 text-xs uppercase tracking-widest mb-1.5 block">Poster URL</label>
                    <input
                      type="url"
                      value={editThumbnail}
                      onChange={e => setEditThumbnail(e.target.value)}
                      placeholder="https://image.tmdb.org/…"
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSave}
                  disabled={!editTitle.trim() || saving}
                  className="w-full bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium rounded-xl px-4 py-3 transition-colors mb-4 flex items-center justify-center gap-2"
                >
                  {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save'}
                </button>

                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 text-stone-500 hover:text-red-400 text-sm transition-colors py-2"
                >
                  <Trash2 size={15} /> Delete session
                </button>
              </>
            ) : (
              /* ── Delete confirm view (same sheet) ── */
              <>
                <div className="flex items-center justify-between mb-5">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="text-stone-500 hover:text-stone-300 transition-colors text-sm flex items-center gap-1.5"
                  >
                    ← Back
                  </button>
                  <button onClick={closeEdit} className="text-stone-500 hover:text-stone-300 transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <div className="flex flex-col items-center text-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-red-950/60 flex items-center justify-center">
                    <Trash2 size={20} className="text-red-400" />
                  </div>
                  <div>
                    <p className="text-amber-100 font-medium mb-1">Delete this session?</p>
                    <p className="text-stone-400 text-sm">
                      <span className="text-amber-200">{editingSession.title}</span> will be permanently removed.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full bg-red-900/60 hover:bg-red-900 disabled:opacity-40 text-red-300 font-medium rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2 mb-3"
                >
                  {deleting ? <><Loader2 size={16} className="animate-spin" /> Deleting…</> : 'Delete permanently'}
                </button>

                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full text-stone-500 hover:text-stone-300 text-sm transition-colors py-2"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
