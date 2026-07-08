'use client'

import { useState } from 'react'
import { updateTogetherSince, toggleTimer, updateDisplayName, saveJellyfinSettings, saveRealDebridSettings, saveTorBoxSettings, saveTheme, saveUsername } from './actions'
import { Copy, Check } from 'lucide-react'

type InviteProps = { type: 'invite'; inviteLink: string }
type TimerProps = { type: 'timer'; showTimer: boolean; togetherSince: string }
type NameProps = { type: 'name'; displayName: string }
type JellyfinProps = { type: 'jellyfin'; jellyfinUrl: string; jellyfinApiKey: string }
type RealDebridProps = { type: 'realdebrid'; rdApiKey: string }
type TorBoxProps = { type: 'torbox'; apiKey: string }
type ThemeProps = { type: 'theme'; currentTheme: string }
type UsernameProps = { type: 'username'; username: string | null }
type Props = InviteProps | TimerProps | NameProps | JellyfinProps | RealDebridProps | TorBoxProps | ThemeProps | UsernameProps

export default function SettingsClient(props: Props) {
  if (props.type === 'invite') return <InviteSection {...props} />
  if (props.type === 'name') return <NameSection {...props} />
  if (props.type === 'username') return <UsernameSection {...props} />
  if (props.type === 'jellyfin') return <JellyfinSection {...props} />
  if (props.type === 'realdebrid') return <RealDebridSection {...props} />
  if (props.type === 'torbox') return <TorBoxSection {...props} />
  if (props.type === 'theme') return <ThemeSection {...props} />
  return <TimerSection {...props} />
}

function UsernameSection({ username }: UsernameProps) {
  const [value, setValue] = useState(username ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const locked = !!username

  async function handleSave() {
    setError(null)
    const result = await saveUsername(value)
    if (result?.error) setError(result.error)
    else setSaved(true)
  }

  if (locked) {
    return (
      <div className="flex items-center gap-3 bg-stone-950 border border-stone-800 rounded-xl px-4 py-3">
        <span className="text-amber-50 flex-1">@{username}</span>
        <span className="text-stone-600 text-xs">locked</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none">@</span>
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
            maxLength={20}
            disabled={saved}
            className="w-full bg-stone-950 border border-stone-800 rounded-xl pl-8 pr-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
            placeholder="yourname"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={value.length < 3 || saved}
          className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 text-sm px-4 py-3 rounded-xl transition-colors flex-shrink-0"
        >
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <p className="text-stone-600 text-xs px-1">Becomes your profile URL — can't be changed after saving.</p>
    </div>
  )
}

const THEMES = [
  { key: 'coffee',   name: 'Coffee',   bg: '#0e0804', accent: '#b45309', text: '#fef3c7' },
  { key: 'midnight', name: 'Midnight', bg: '#07071a', accent: '#6366f1', text: '#f5f3ff' },
  { key: 'rose',     name: 'Rose',     bg: '#180a0a', accent: '#e11d48', text: '#fff1f2' },
  { key: 'forest',   name: 'Forest',   bg: '#030f07', accent: '#059669', text: '#ecfdf5' },
  { key: 'ocean',    name: 'Ocean',    bg: '#030d18', accent: '#0891b2', text: '#ecfeff' },
]

function ThemeSection({ currentTheme }: ThemeProps) {
  const [active, setActive] = useState(currentTheme)

  async function handleSelect(key: string) {
    setActive(key)
    document.documentElement.setAttribute('data-theme', key)
    await saveTheme(key)
  }

  return (
    <div className="flex flex-wrap gap-3">
      {THEMES.map(t => (
        <button
          key={t.key}
          onClick={() => handleSelect(t.key)}
          className="flex flex-col items-center gap-2 group"
        >
          <div
            className={`w-14 h-14 rounded-2xl border-2 transition-all flex items-end justify-end p-1.5 ${
              active === t.key ? 'border-amber-500 scale-105' : 'border-transparent hover:border-stone-600'
            }`}
            style={{ background: t.bg }}
          >
            <div className="w-5 h-5 rounded-lg" style={{ background: t.accent }} />
          </div>
          <span className={`text-xs transition-colors ${active === t.key ? 'text-amber-300' : 'text-stone-500 group-hover:text-stone-400'}`}>
            {t.name}
          </span>
        </button>
      ))}
    </div>
  )
}

function NameSection({ displayName }: NameProps) {
  const [name, setName] = useState(displayName)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    await updateDisplayName(name.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-amber-50 focus:outline-none focus:border-amber-700 transition-colors"
        placeholder="Your name"
      />
      <button
        onClick={handleSave}
        disabled={!name.trim()}
        className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 text-sm px-4 py-2.5 rounded-xl transition-colors flex-shrink-0"
      >
        {saved ? 'Saved!' : 'Save'}
      </button>
    </div>
  )
}

function InviteSection({ inviteLink }: InviteProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex gap-2">
      <input
        readOnly
        value={inviteLink}
        className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-stone-400 text-xs truncate focus:outline-none"
      />
      <button
        onClick={copy}
        className="flex items-center gap-1.5 bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm px-3 py-2.5 rounded-xl transition-colors flex-shrink-0"
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

function JellyfinSection({ jellyfinUrl, jellyfinApiKey }: JellyfinProps) {
  const [url, setUrl] = useState(jellyfinUrl)
  const [apiKey, setApiKey] = useState(jellyfinApiKey)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    await saveJellyfinSettings(url.trim(), apiKey.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-stone-400 text-xs uppercase tracking-widest mb-1.5 block">Server URL</label>
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
          placeholder="http://100.x.x.x:8096"
        />
      </div>
      <div>
        <label className="text-stone-400 text-xs uppercase tracking-widest mb-1.5 block">API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
          placeholder="Paste your Jellyfin API key"
        />
      </div>
      <button
        onClick={handleSave}
        disabled={!url.trim() || !apiKey.trim()}
        className="self-end bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 text-sm px-4 py-2.5 rounded-xl transition-colors"
      >
        {saved ? 'Saved!' : 'Save'}
      </button>
    </div>
  )
}

function RealDebridSection({ rdApiKey }: RealDebridProps) {
  const [apiKey, setApiKey] = useState(rdApiKey)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    await saveRealDebridSettings(apiKey.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-stone-400 text-xs uppercase tracking-widest mb-1.5 block">API Token</label>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
          placeholder="Paste your Real-Debrid API token"
        />
        <p className="text-stone-600 text-xs mt-1.5 px-1">
          real-debrid.com → My Account → API token
        </p>
      </div>
      <button
        onClick={handleSave}
        disabled={!apiKey.trim()}
        className="self-end bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 text-sm px-4 py-2.5 rounded-xl transition-colors"
      >
        {saved ? 'Saved!' : 'Save'}
      </button>
    </div>
  )
}

function TimerSection({ showTimer, togetherSince }: TimerProps) {
  const [show, setShow] = useState(showTimer)
  const [date, setDate] = useState(togetherSince)
  const [saved, setSaved] = useState(false)

  async function handleToggle() {
    const next = !show
    setShow(next)
    await toggleTimer(next)
  }

  async function handleDateSave() {
    await updateTogetherSince(date)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-stone-300 text-sm">Show timer</span>
        <button
          onClick={handleToggle}
          className={`w-11 h-6 rounded-full transition-colors relative ${show ? 'bg-amber-600' : 'bg-stone-700'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${show ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* Together since */}
      <div className="flex flex-col gap-1.5">
        <label className="text-stone-400 text-xs uppercase tracking-widest">Together since</label>
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-amber-50 focus:outline-none focus:border-amber-700 transition-colors"
          />
          <button
            onClick={handleDateSave}
            className="bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm px-4 py-2.5 rounded-xl transition-colors flex-shrink-0"
          >
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TorBoxSection({ apiKey }: TorBoxProps) {
  const [key, setKey] = useState(apiKey)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    await saveTorBoxSettings(key.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-stone-400 text-xs uppercase tracking-widest mb-1.5 block">API Token</label>
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
          placeholder="Paste your TorBox API token"
        />
        <p className="text-stone-600 text-xs mt-1.5 px-1">
          torbox.app → Settings → API token
        </p>
      </div>
      <button
        onClick={handleSave}
        disabled={!key.trim()}
        className="self-end bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 text-sm px-4 py-2.5 rounded-xl transition-colors"
      >
        {saved ? 'Saved!' : 'Save'}
      </button>
    </div>
  )
}
