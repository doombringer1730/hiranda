import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/page-header'
import PrintPicker, { type PrintPhoto } from './print-picker'

export const metadata = { title: 'Order prints · Hiranda' }

// Pick photos from your memories to print: Polaroid-style prints, or a bound
// photo book. Ordering and checkout happen in the shop (/store/print).
export default async function PrintPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('photos')
    .select('id, storage_path, caption, memories!inner(id, title, happened_at)')
    .order('created_at', { ascending: true })
    .limit(600)
  type Row = { id: string; storage_path: string; caption: string | null; memories: { id: string; title: string; happened_at: string } | { id: string; title: string; happened_at: string }[] }
  const rows = (data ?? []) as Row[]

  const urls = new Map<string, string>()
  if (rows.length) {
    const { data: signed } = await supabase.storage.from('photos').createSignedUrls(rows.map(r => r.storage_path), 60 * 60 * 3)
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl)
  }

  // Oldest memory first, so a book reads like your story.
  const photos: PrintPhoto[] = rows.flatMap(r => {
    const m = Array.isArray(r.memories) ? r.memories[0] : r.memories
    const url = urls.get(r.storage_path)
    return url && m ? [{ id: r.id, url, caption: r.caption || m.title, memory: m.title, date: m.happened_at }] : []
  }).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="px-4 pt-6 pb-36 max-w-2xl md:max-w-4xl mx-auto">
      <PageHeader eyebrow="Ours, on paper" title="Order prints" />
      <p className="font-hand text-[22px] text-stone-400 mt-2 mb-6">the good ones, to hold in your hands.</p>
      <PrintPicker photos={photos} initialKind={kind === 'book' ? 'book' : 'polaroids'} />
    </div>
  )
}
