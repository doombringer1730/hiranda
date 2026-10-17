'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { cleanLove, cleanTyping, pickMeta, roomFromPath, samePlace, type Place } from '@/lib/shared-space-state'

// "Shared space": each partner sees where the other is in the app (which
// section, which memory, whether they're typing an answer), live. It runs on
// one private Realtime channel per couple, `space:<couple id>`, and never
// touches the database:
//   - Presence carries where each device is (and whether it's on screen).
//     Supabase clears it by itself when a device disconnects.
//   - Broadcast carries typing pings, which are too frequent for presence,
//     and "thinking of you" hearts, which float up on the partner's screen.
// Migration 050 decides who may join: only the couple's two members.
//
// Renders: the channel lives in a store outside React; components subscribe
// to just the piece they show (useSyncExternalStore), so a typing ping only
// re-renders the "is typing" line for that item, not the page.

export type PartnerHere = { online: boolean; visible: boolean; place: Place | null; name: string | null }

const OFFLINE: PartnerHere = { online: false, visible: false, place: null, name: null }
const TRACK_DELAY = 250 // ms: coalesce quick navigation into one presence update
const TYPING_EVERY = 1500 // ms between "still typing" pings
const TYPING_IDLE = 2500 // ms without a keystroke → "stopped"
const TYPING_TTL = 4000 // ms a ping counts for if the "stopped" one is lost

class SpaceStore {
  partner: PartnerHere = OFFLINE
  private typing = new Map<string, number>() // item → expires at
  private typingTimer: ReturnType<typeof setTimeout> | null = null
  private listeners = new Set<() => void>()
  private loveListeners = new Set<() => void>()

  private channel: RealtimeChannel | null = null
  private path = '/'
  private announced: { token: symbol; place: Place }[] = []
  private sent: { place: Place | null; visible: boolean } | null = null
  private trackTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private partnerId: string, private myName: string) {}

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private emit() { for (const fn of this.listeners) fn() }

  // ── the partner ──

  onPresence(state: Record<string, unknown[]>) {
    const meta = pickMeta(state[this.partnerId])
    const next: PartnerHere = meta ? { online: true, visible: meta.visible, place: meta.place, name: meta.name ?? null } : OFFLINE
    const p = this.partner
    if (p.online === next.online && p.visible === next.visible && p.name === next.name && samePlace(p.place, next.place)) return
    this.partner = next
    if (!next.online) this.typing.clear()
    this.emit()
  }

  onTyping(payload: unknown) {
    const t = cleanTyping(payload)
    if (!t) return
    const was = this.isTyping(t.item)
    if (t.on) this.typing.set(t.item, Date.now() + TYPING_TTL)
    else this.typing.delete(t.item)
    this.scheduleTypingExpiry()
    if (this.isTyping(t.item) !== was) this.emit()
  }

  // ── hearts ──

  onLove(payload: unknown) {
    if (!cleanLove(payload)) return
    for (const fn of this.loveListeners) fn()
  }

  onLoveFromPartner = (fn: () => void) => { this.loveListeners.add(fn); return () => { this.loveListeners.delete(fn) } }

  /** Float a heart on your partner's screen, if they're here. */
  sendLove() {
    if (!this.channel || !this.partner.online) return false
    void this.channel.send({ type: 'broadcast', event: 'love', payload: { at: Date.now() } })
    return true
  }

  isTyping = (item: string) => (this.typing.get(item) ?? 0) > Date.now()

  private scheduleTypingExpiry() {
    if (this.typingTimer) clearTimeout(this.typingTimer)
    this.typingTimer = null
    if (this.typing.size === 0) return
    const next = Math.min(...this.typing.values())
    this.typingTimer = setTimeout(() => {
      const now = Date.now()
      let changed = false
      for (const [item, until] of this.typing) if (until <= now) { this.typing.delete(item); changed = true }
      this.scheduleTypingExpiry()
      if (changed) this.emit()
    }, Math.max(0, next - Date.now()) + 10)
  }

  // ── me ──

  connect(channel: RealtimeChannel | null) {
    this.channel = channel
    this.sent = null // (re)joined: announce again
    if (!channel) { this.partner = OFFLINE; this.typing.clear(); this.emit() } else this.scheduleTrack()
  }

  setPath(path: string) { this.path = path; this.scheduleTrack() }

  announce(place: Place) {
    const token = Symbol()
    this.announced.push({ token, place })
    this.scheduleTrack()
    return () => { this.announced = this.announced.filter(a => a.token !== token); this.scheduleTrack() }
  }

  private myPlace(): Place {
    return this.announced.at(-1)?.place ?? { room: roomFromPath(this.path) }
  }

  scheduleTrack() {
    if (this.trackTimer) return
    this.trackTimer = setTimeout(() => {
      this.trackTimer = null
      const ch = this.channel
      if (!ch) return
      const place = this.myPlace(), visible = document.visibilityState === 'visible'
      if (this.sent && this.sent.visible === visible && samePlace(this.sent.place, place)) return
      this.sent = { place, visible }
      void ch.track({ place, visible, at: Date.now(), name: this.myName })
    }, TRACK_DELAY)
  }

  sendTyping(item: string, on: boolean) {
    void this.channel?.send({ type: 'broadcast', event: 'typing', payload: { item, on } })
  }

  dispose() {
    if (this.trackTimer) clearTimeout(this.trackTimer)
    if (this.typingTimer) clearTimeout(this.typingTimer)
    this.listeners.clear()
    this.loveListeners.clear()
  }
}

const Space = createContext<SpaceStore | null>(null)

/** One shared-space channel for the whole signed-in app (see (app)/layout.tsx). */
export function SharedSpaceProvider({ coupleId, myId, partnerId, myName, children }: {
  coupleId: string; myId: string; partnerId: string; myName: string; children: React.ReactNode
}) {
  const [store] = useState(() => new SpaceStore(partnerId, myName))
  const path = usePathname()
  useEffect(() => { store.setPath(path) }, [store, path])

  useEffect(() => {
    let cancelled = false
    let channel: RealtimeChannel | null = null
    const supabase = createClient()
    const onVisibility = () => store.scheduleTrack()

    // A private channel is authorized with the user's token (migration 050).
    supabase.realtime.setAuth().then(() => {
      if (cancelled) return
      channel = supabase
        .channel(`space:${coupleId}`, { config: { private: true, presence: { key: myId }, broadcast: { self: false } } })
        .on('presence', { event: 'sync' }, () => store.onPresence(channel!.presenceState()))
        .on('broadcast', { event: 'typing' }, ({ payload }) => store.onTyping(payload))
        .on('broadcast', { event: 'love' }, ({ payload }) => store.onLove(payload))
        .subscribe(status => {
          if (status === 'SUBSCRIBED') store.connect(channel)
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') store.connect(null)
        })
    })
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      store.connect(null)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [store, coupleId, myId])

  useEffect(() => () => store.dispose(), [store])
  return <Space.Provider value={store}>{children}</Space.Provider>
}

const noop = () => () => {}

/** Where your partner is right now. Re-renders only when that changes. */
export function usePartnerHere(): PartnerHere {
  const store = useContext(Space)
  return useSyncExternalStore(store?.subscribe ?? noop, () => store?.partner ?? OFFLINE, () => OFFLINE)
}

/** Is your partner looking at this room (and item) right now? */
export function usePartnerAt(room: string, item?: string): boolean {
  const store = useContext(Space)
  const get = () => {
    const p = store?.partner
    return !!p?.online && p.visible && p.place?.room === room && (item === undefined || p.place.item === item)
  }
  return useSyncExternalStore(store?.subscribe ?? noop, get, () => false)
}

/** Is your partner typing in this item (e.g. today's answer)? */
export function usePartnerTyping(item: string): boolean {
  const store = useContext(Space)
  return useSyncExternalStore(store?.subscribe ?? noop, () => !!store?.isTyping(item), () => false)
}

/** Tell your partner you're here: a page or open item, while it's mounted. */
export function useHere(place: Place | null) {
  const store = useContext(Space)
  const { room, item, label } = place ?? {}
  useEffect(() => {
    if (!store || !room) return
    return store.announce({ room, ...(item ? { item } : {}), ...(label ? { label } : {}) })
  }, [store, room, item, label])
}

/** Returns a function that floats a heart on your partner's screen (if they're online). */
export function useSendLoveSignal() {
  const store = useContext(Space)
  return useCallback(() => store?.sendLove() ?? false, [store])
}

/** Runs `onHeart` each time your partner sends you a heart while you're here. */
export function useLoveFromPartner(onHeart: () => void) {
  const store = useContext(Space)
  const cb = useRef(onHeart)
  useEffect(() => { cb.current = onHeart })
  useEffect(() => store?.onLoveFromPartner(() => cb.current()), [store])
}

/**
 * Typing pings for one item. Call the returned function on every keystroke;
 * it sends at most one "typing" every 1.5s and a "stopped" after 2.5s idle,
 * on blur, or when the component goes away.
 */
export function useTypingSignal(item: string | null) {
  const store = useContext(Space)
  const last = useRef(0)
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = useCallback(() => {
    if (idle.current) clearTimeout(idle.current)
    idle.current = null
    if (last.current && item) store?.sendTyping(item, false)
    last.current = 0
  }, [store, item])

  useEffect(() => stop, [stop])

  const ping = useCallback(() => {
    if (!store || !item) return
    const now = Date.now()
    if (now - last.current > TYPING_EVERY) { store.sendTyping(item, true); last.current = now }
    if (idle.current) clearTimeout(idle.current)
    idle.current = setTimeout(stop, TYPING_IDLE)
  }, [store, item, stop])

  return { ping, stop }
}
