import Link from 'next/link'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/page-header'
import { coupleContext } from '@/lib/couple'
import { getPeople } from '@/lib/profiles'
import { stripeOpenTo, stripeTestMode } from '@/lib/billing'
import { findProduct } from '@/lib/store/products'
import { PRINT_KINDS, isPrintKind, parsePhotoIds } from '@/lib/store/prints'
import { storeEnabled } from '@/lib/store/server'
import TestCardHint from '@/components/test-card-hint'
import PrintClient from './print-client'

export const metadata = { title: 'Prints of your memories' }

// Polaroids or a photo book from photos picked in Memories:
//   /store/print?kind=polaroids|book&photos=<photo id>,<photo id>,…
export default async function PrintPage({ searchParams }: { searchParams: Promise<{ kind?: string; photos?: string }> }) {
  const ctx = await coupleContext()
  if (!ctx) redirect('/')
  const { kind = 'polaroids', photos: raw } = await searchParams
  if (!isPrintKind(kind)) redirect('/store')
  const cfg = PRINT_KINDS[kind]
  const product = await findProduct(cfg.productKey)
  if (!product) redirect('/store')

  const ids = parsePhotoIds(raw, cfg.max)
  const [people, { data: partnerReady }, { data: rows }] = await Promise.all([
    getPeople(),
    ctx.supabase.rpc('partner_has_gift_address'),
    ids.length
      ? ctx.supabase.from('photos').select('id, storage_path, caption, memories(title)').in('id', ids)
      : Promise.resolve({ data: [] as { id: string; storage_path: string; caption: string | null; memories: unknown }[] }),
  ])
  const { data: signed } = rows?.length
    ? await ctx.supabase.storage.from('photos').createSignedUrls(rows.map(r => r.storage_path), 3600)
    : { data: [] }
  const urlOf = new Map((signed ?? []).map(s => [s.path, s.signedUrl]))
  const byId = new Map((rows ?? []).map(r => {
    const m = r.memories as { title?: string | null } | { title?: string | null }[] | null
    const title = Array.isArray(m) ? m[0]?.title : m?.title
    return [r.id, { id: r.id, url: urlOf.get(r.storage_path) ?? '', caption: r.caption?.trim() || title?.trim() || '' }]
  }))
  const photos = ids.map(id => byId.get(id)).filter(p => !!p?.url) as { id: string; url: string; caption: string }[]
  const partner = people.get(ctx.partnerId)?.first ?? 'your partner'
  const open = storeEnabled() && stripeOpenTo(ctx.user.email)

  return (
    <div className="px-4 pt-6 pb-12 max-w-2xl mx-auto">
      <Link href="/store" className="text-stone-500 hover:text-amber-300 text-sm">← Store</Link>
      <PageHeader eyebrow="From your memories" title={product.title} />
      <p className="text-stone-400 text-sm mt-1">{product.blurb}</p>
      {open && stripeTestMode() && <div className="mt-5"><TestCardHint /></div>}
      {photos.length ? (
        <PrintClient kind={kind} photos={photos} partner={partner} canSend={open && !!partnerReady} partnerReady={!!partnerReady}
          max={cfg.max} fineprint={product.fineprint ?? null} />
      ) : (
        <div className="paper mt-6 rounded-[6px] px-6 py-6 text-center">
          <p className="font-hand text-[26px] text-[var(--paper-ink)]">Pick your photos first.</p>
          <p className="text-sm text-[var(--paper-muted)] mt-1">
            Choose up to {cfg.max} photos in Memories{kind === 'book' ? ', in the order you want them in the book' : ''}.
          </p>
          <Link href={`/memories/print?kind=${kind}`} className="mt-4 inline-flex items-center h-11 px-5 rounded-full bg-[var(--paper-ink)] text-[var(--paper)] text-sm font-medium">Go to Memories</Link>
        </div>
      )}
    </div>
  )
}
