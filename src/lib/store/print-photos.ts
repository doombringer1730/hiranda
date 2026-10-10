import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'

export type PrintPhoto = { id: string; url: string; caption: string }

/** The photos to print for a couple, in the order given: only photos one of
 *  the two uploaded, each with a short-lived signed link and its caption
 *  (falling back to its memory's title). Uses the service role. */
export async function couplePrintPhotos(db: ReturnType<typeof createAdminClient>, coupleId: string, ids: string[]): Promise<PrintPhoto[]> {
  if (!ids.length) return []
  const { data: couple } = await db.from('couple').select('user1_id, user2_id').eq('id', coupleId).maybeSingle()
  if (!couple) return []
  const members = [couple.user1_id, couple.user2_id].filter(Boolean)
  const { data: rows } = await db.from('photos')
    .select('id, storage_path, caption, uploaded_by, memories(title)')
    .in('id', ids).in('uploaded_by', members)
  if (!rows?.length) return []
  const { data: signed } = await db.storage.from('photos').createSignedUrls(rows.map(r => r.storage_path), 60 * 60)
  const urlOf = new Map((signed ?? []).map(s => [s.path, s.signedUrl]))
  const byId = new Map(rows.map(r => {
    const memory = r.memories as { title?: string | null } | { title?: string | null }[] | null
    const title = Array.isArray(memory) ? memory[0]?.title : memory?.title
    return [r.id, { id: r.id, url: urlOf.get(r.storage_path) ?? '', caption: (r.caption?.trim() || title?.trim() || '').slice(0, 80) }]
  }))
  return ids.map(id => byId.get(id)).filter((p): p is PrintPhoto => !!p?.url)
}
