'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseCustomTheme, customThemeKey, customThemeVars, customSwatch, baseTheme, DEFAULT_CUSTOM, type CustomTheme } from '@/lib/custom-theme'
import { updateTogetherSince, toggleTimer, updateDisplayName, saveTheme, saveUsername } from './actions'
import { Copy, Check, Palette } from 'lucide-react'

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

// Apply a theme to the page right away, before the server catches up.
function applyTheme(key: string) {
  const root = document.documentElement
  for (const name of Array.from(root.style)) if (name.startsWith('--color-')) root.style.removeProperty(name)
  const custom = parseCustomTheme(key)
  if (!custom) { root.setAttribute('data-theme', key); return }
  root.setAttribute('data-theme', baseTheme(custom))
  for (const [name, value] of Object.entries(customThemeVars(custom))) root.style.setProperty(name, value)
}

function ThemeSection({ currentTheme, plus }: ThemeProps) {
  const [active, setActive] = useState(currentTheme)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<CustomTheme>(parseCustomTheme(currentTheme) ?? DEFAULT_CUSTOM)
  const router = useRouter()
  const custom = parseCustomTheme(active)

  async function handleSelect(key: string) {
    setEditing(false)
    setActive(key)
    applyTheme(key)
    await saveTheme(key)
  }

  function openEditor() {
    // Your own theme is Plus: send free couples to the Plus page instead.
    if (!plus) { router.push('/plus'); return }
    setEditing(true)
    applyTheme(customThemeKey(draft))
  }

  function change(next: CustomTheme) {
    setDraft(next)
    applyTheme(customThemeKey(next))
  }

  function cancel() {
    setEditing(false)
    applyTheme(active)
  }

  const yours = customSwatch(custom ?? draft)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {THEMES.map(t => (
          <button
            key={t.key}
            onClick={() => handleSelect(t.key)}
            className="flex flex-col items-center gap-2 group"
          >
            <div
              className={`relative w-14 h-14 rounded-2xl border-2 transition-all flex items-end justify-end p-1.5 ${
                active === t.key && !editing ? 'border-amber-500 scale-105' : 'border-transparent hover:border-stone-600'
              }`}
              style={{ background: t.bg }}
            >
              <div className="w-5 h-5 rounded-lg" style={{ background: t.accent }} />
            </div>
            <span className={`text-xs transition-colors ${active === t.key && !editing ? 'text-amber-300' : 'text-stone-500 group-hover:text-stone-400'}`}>
              {t.name}
            </span>
          </button>
        ))}
        <button onClick={openEditor} className="flex flex-col items-center gap-2 group">
          <div
            className={`relative w-14 h-14 rounded-2xl border-2 transition-all flex items-center justify-center ${
              custom || editing ? 'border-amber-500 scale-105' : 'border-dashed border-stone-600 hover:border-stone-500'
            }`}
            style={{ background: custom || editing ? yours.bg : undefined }}
          >
            {custom || editing
              ? <div className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-lg" style={{ background: yours.accent }} />
              : <Palette size={20} className="text-stone-500" />}
            {!plus && (
              <span className="absolute -top-1.5 -right-1.5 rounded-full bg-amber-700 text-amber-50 text-[9px] font-semibold px-1.5 py-0.5">PLUS</span>
            )}
          </div>
          <span className={`text-xs transition-colors ${custom || editing ? 'text-amber-300' : 'text-stone-500 group-hover:text-stone-400'}`}>
            Your own
          </span>
        </button>
      </div>

      {editing && (
        <div className="flex flex-col gap-4 bg-stone-950 border border-stone-800 rounded-xl p-4 animate-rise">
          <p className="text-stone-400 text-sm">Slide to pick your colours. The whole app changes as you go.</p>
          <HueSlider label="Background" value={draft.bg} onChange={bg => change({ ...draft, bg })} muted />
          <HueSlider label="Accent" value={draft.accent} onChange={accent => change({ ...draft, accent })} />
          <div className="grid grid-cols-2 gap-1 bg-stone-900 rounded-full p-1">
            {[false, true].map(light => (
              <button key={String(light)} onClick={() => change({ ...draft, light })}
                className={`h-9 rounded-full text-sm transition-colors ${draft.light === light ? 'bg-amber-700 text-amber-50' : 'text-stone-400'}`}>
                {light ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={cancel} className="flex-1 h-11 rounded-xl border border-stone-700 text-stone-300 text-sm">Cancel</button>
            <button onClick={() => handleSelect(customThemeKey(draft))} className="flex-1 h-11 rounded-xl bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm">Use this theme</button>
          </div>
        </div>
      )}
    </div>
  )
}

function HueSlider({ label, value, onChange, muted }: { label: string; value: number; onChange: (v: number) => void; muted?: boolean }) {
  const c = muted ? 0.08 : 0.14
  const stops = Array.from({ length: 13 }, (_, i) => `oklch(0.62 ${c} ${i * 30})`).join(', ')
  return (
    <label className="flex flex-col gap-2">
      <span className="text-stone-400 text-xs uppercase tracking-wider">{label}</span>
      <input
        type="range" min={0} max={359} value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-label={`${label} colour`}
        className="hue-slider h-8 w-full rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, ${stops})` }}
      />
    </label>
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
