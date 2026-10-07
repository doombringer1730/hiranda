'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FREE_THEMES } from '@/lib/plus-config'
import { updateTogetherSince, toggleTimer, updateDisplayName, saveTheme, saveUsername } from './actions'
import { Copy, Check } from 'lucide-react'

type InviteProps = { type: 'invite'; inviteLink: string }
type TimerProps = { type: 'timer'; showTimer: boolean; togetherSince: string }
type NameProps = { type: 'name'; displayName: string }
type ThemeProps = { type: 'theme'; currentTheme: string; plus: boolean }
type UsernameProps = { type: 'username'; username: string | null }
type Props = InviteProps | TimerProps | NameProps | ThemeProps | UsernameProps

export default function SettingsClient(props: Props) {
  if (props.type === 'invite') return <InviteSection {...props} />
  if (props.type === 'name') return <NameSection {...props} />
  if (props.type === 'username') return <UsernameSection {...props} />
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
      <p className="text-stone-600 text-xs px-1">Becomes your profile URL — can’t be changed after saving.</p>
    </div>
  )
}

const THEMES = [
  { key: 'coffee', name: 'Mocha', bg: '#130d08', accent: '#5090b4', text: '#f1f7fb' },
  { key: 'preppy', name: 'Preppy', bg: '#0a0e16', accent: '#c26587', text: '#fdf2f6' },
  { key: 'midnight', name: 'Midnight', bg: '#0c0e17', accent: '#b87721', text: '#fcf4ed' },
  { key: 'rose', name: 'Cherry', bg: '#0d0f11', accent: '#d95659', text: '#fef3f2' },
  { key: 'forest', name: 'Forest', bg: '#08110c', accent: '#be7241', text: '#fdf4ef' },
  { key: 'ocean', name: 'Ocean', bg: '#061015', accent: '#c46c4d', text: '#fef3f0' },
  { key: 'glacier', name: 'Glacier', bg: '#071015', accent: '#968752', text: '#f7f6f0' },
  { key: 'cloud', name: 'Cloud', bg: '#f2f0ed', accent: '#5297cf', text: '#161b1f' },
]

function ThemeSection({ currentTheme, plus }: ThemeProps) {
  const [active, setActive] = useState(currentTheme)
  const router = useRouter()

  async function handleSelect(key: string) {
    // Plus themes: send free couples to the Plus page instead.
    if (!plus && !FREE_THEMES.has(key)) { router.push('/plus'); return }
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
            className={`relative w-14 h-14 rounded-2xl border-2 transition-all flex items-end justify-end p-1.5 ${
              active === t.key ? 'border-amber-500 scale-105' : 'border-transparent hover:border-stone-600'
            }`}
            style={{ background: t.bg }}
          >
            <div className="w-5 h-5 rounded-lg" style={{ background: t.accent }} />
            {!plus && !FREE_THEMES.has(t.key) && (
              <span className="absolute -top-1.5 -right-1.5 rounded-full bg-amber-700 text-amber-50 text-[9px] font-semibold px-1.5 py-0.5">PLUS</span>
            )}
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
