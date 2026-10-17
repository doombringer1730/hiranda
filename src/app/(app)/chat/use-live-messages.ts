'use client'

import { useLiveRows } from '@/lib/use-live-rows'
import { getMessages, type Message } from './actions'

const byTime = (a: Message, b: Message) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)

// The same fields getMessages() selects, so a realtime row and a loaded row
// compare equal (couple_id is in the event but not in the list).
const toMessage = (r: Record<string, unknown>) => ({
  id: r.id, sender: r.sender, kind: r.kind, body: r.body, reaction: r.reaction, read_at: r.read_at, created_at: r.created_at,
}) as Message

/** The newest page of this space's chat, kept live: oldest first. */
export function useLiveMessages(coupleId: string | null) {
  return useLiveRows<Message>({
    table: 'messages',
    filter: coupleId ? `couple_id=eq.${coupleId}` : undefined,
    enabled: !!coupleId,
    load: async () => (await getMessages())?.messages ?? null,
    compare: byTime,
    toRow: toMessage,
  })
}
