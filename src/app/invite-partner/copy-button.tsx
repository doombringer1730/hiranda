'use client'

import { useState, useSyncExternalStore } from 'react'
import { Copy, Check, Share, MessageSquare, Mail } from 'lucide-react'
import { hasPlugin, shareSheet } from '@/lib/native'

const noop = () => () => {}

// Every easy way to get the link to your partner: the share sheet on phones,
// then Messages, WhatsApp, email and copy — each with a message they'll want
// to open, not a bare URL.
export default function CopyInviteButton({ link, from }: { link: string; from: string | null }) {
  const [copied, setCopied] = useState(false)
  // Decided in the browser only, so server and client render the same markup.
  const canShare = useSyncExternalStore(noop,
    () => hasPlugin('Share') || ('share' in navigator && /android|iphone|ipad|ipod/i.test(navigator.userAgent)), () => false)
  const isPhone = useSyncExternalStore(noop, () => /android|iphone|ipad|ipod/i.test(navigator.userAgent), () => false)

  const text = `I made us a little place on Hiranda 💗 Come join me — it only takes a minute:`
  const full = `${text} ${link}`
  const subject = from ? `${from} saved you a seat on Hiranda` : 'Join me on Hiranda'

  async function copy() {
    try {
      await navigator.clipboard.writeText(full)
    } catch {
      // Older/insecure contexts: fall back to a hidden textarea.
      const t = document.createElement('textarea'); t.value = full; document.body.appendChild(t); t.select()
      document.execCommand('copy'); t.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function share() {
    try {
      await shareSheet({ title: subject, text, url: link })
    } catch {
      // cancelled — nothing to do
    }
  }

  const quick = 'flex flex-col items-center justify-center gap-1 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium py-2.5 transition-colors'
  return (
    <div className="flex flex-col gap-2">
      {canShare && (
        <button onClick={share}
          className="w-full flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium rounded-xl px-4 py-3 transition-colors">
          <Share size={16} /> Send invite
        </button>
      )}
      <div className={`grid gap-2 ${isPhone ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {isPhone && (
          <a href={`sms:?&body=${encodeURIComponent(full)}`} className={quick}><MessageSquare size={16} />Text</a>
        )}
        <a href={`https://wa.me/?text=${encodeURIComponent(full)}`} target="_blank" rel="noreferrer" className={quick}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.3Z"/></svg>
          WhatsApp
        </a>
        <a href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(full)}`} className={quick}><Mail size={16} />Email</a>
        <button onClick={copy} className={`${quick} ${canShare ? '' : 'bg-amber-700 hover:bg-amber-600 text-amber-50'}`}>
          {copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
