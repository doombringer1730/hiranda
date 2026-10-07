'use client'

import { useState, useSyncExternalStore } from 'react'
import { Copy, Check, Share } from 'lucide-react'
import { hasPlugin, shareSheet } from '@/lib/native'

// On phones, opens the share sheet (Messages, WhatsApp…); elsewhere copies.
export default function CopyInviteButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)
  // Decided in the browser only, so server and client render the same markup.
  const canShare = useSyncExternalStore(
    () => () => {},
    () => hasPlugin('Share') || ('share' in navigator && /android|iphone|ipad|ipod/i.test(navigator.userAgent)),
    () => false,
  )

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      // Older/insecure contexts: fall back to a hidden textarea.
      const t = document.createElement('textarea'); t.value = link; document.body.appendChild(t); t.select()
      document.execCommand('copy'); t.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function share() {
    try {
      await shareSheet({ title: 'Join me on Hiranda', text: 'Join our little place on Hiranda 💗', url: link })
    } catch {
      // cancelled — nothing to do
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {canShare && (
        <button
          onClick={share}
          className="w-full flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium rounded-xl px-4 py-3 transition-colors"
        >
          <Share size={16} /> Send invite
        </button>
      )}
      <button
        onClick={copy}
        className={`w-full flex items-center justify-center gap-2 font-medium rounded-xl px-4 py-3 transition-colors ${
          canShare ? 'bg-stone-800 hover:bg-stone-700 text-stone-200' : 'bg-amber-700 hover:bg-amber-600 text-amber-50'
        }`}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? 'Copied!' : 'Copy invite link'}
      </button>
    </div>
  )
}
