'use client'

import { useState } from 'react'
import { updateTogetherSince, toggleTimer, updateDisplayName } from './actions'
import { Copy, Check } from 'lucide-react'

type InviteProps = { type: 'invite'; inviteLink: string }
type TimerProps = { type: 'timer'; showTimer: boolean; togetherSince: string }
type NameProps = { type: 'name'; displayName: string }
type Props = InviteProps | TimerProps | NameProps

export default function SettingsClient(props: Props) {
  if (props.type === 'invite') return <InviteSection {...props} />
  if (props.type === 'name') return <NameSection {...props} />
  return <TimerSection {...props} />
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
