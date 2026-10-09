import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/admin'
import { MAX_ART, printSignatureOk } from '@/lib/store/print'
import { Heart, INK, MUTED, Names, PAPER, loadFonts } from '@/lib/store/print-art'
import { couplePrintPhotos, type PrintPhoto } from '@/lib/store/print-photos'
import { bookPages } from '@/lib/store/prints'
import { PDFDocument } from 'pdf-lib'

// Print files for gifts, fetched by print partners. Links are signed (see
// lib/store/print.ts).
//   front / back — a flat A5 card with 4 mm bleed at 300 dpi (Gelato):
//                  "for <name>" and the sender's note.
//   design       — the couple's names and year, at the size the product
//                  asks for (blankets, mugs… via Printful / Printify).
//   photo-<n>    — the order's nth photo as a Polaroid-style print.
//   book         — the photo book as one PDF: front cover, then one photo a
//                  page, padded with blank pages to the book's page count.

// A long photo book renders a page at a time.
export const maxDuration = 300

const W = 1843
const H = 2575
const SAFE = 150 // keep words well inside the trim

const firstName = (s: string | null | undefined) => (s ?? '').trim().split(/\s+/)[0] || ''

export async function GET(request: Request, { params }: { params: Promise<{ order: string }> }) {
  const { order: orderId } = await params
  const url = new URL(request.url)
  const side = url.searchParams.get('side') ?? ''
  const size = url.searchParams.get('size') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !printSignatureOk(orderId, side, size, url.searchParams.get('sig'))) {
    return new Response('Not found', { status: 404 })
  }
  const [w, h] = size ? size.split('x').map(Number) : [W, H]
  if (!(w > 0 && h > 0 && w <= MAX_ART && h <= MAX_ART)) return new Response('Bad size', { status: 400 })

  const db = createAdminClient()
  const { data: order } = await db.from('store_orders')
    .select('note, sender_id, recipient_id, status, couple_id, product_key, photos').eq('id', orderId).maybeSingle()
  if (!order || !['paid', 'fulfilling', 'shipped'].includes(order.status)) return new Response('Not found', { status: 404 })
  const { data: people } = await db.from('profiles').select('id, display_name').in('id', [order.sender_id, order.recipient_id])
  const name = (id: string) => firstName(people?.find(p => p.id === id)?.display_name)
  const from = name(order.sender_id) || 'me'
  const to = name(order.recipient_id) || 'you'

  if (side.startsWith('photo-') || side === 'book') {
    const photos = await couplePrintPhotos(db, order.couple_id, (order.photos as string[] | null) ?? [])
    const fonts = await loadFonts()
    if (side === 'book') {
      if (!photos.length) return new Response('Not found', { status: 404 })
      const { data: couple } = await db.from('couple').select('together_since').eq('id', order.couple_id).maybeSingle()
      const year = couple?.together_since ? new Date(couple.together_since).getUTCFullYear() : null
      return bookPdf({ a: from, b: to, year, photos, w, h, fonts })
    }
    const photo = photos[Number(side.slice(6))]
    if (!photo) return new Response('Not found', { status: 404 })
    return new ImageResponse(<Polaroid photo={photo} w={w} h={h} />, {
      width: w, height: h, fonts, headers: { 'Cache-Control': 'private, no-store' },
    })
  }

  if (side === 'design') {
    const { data: couple } = await db.from('couple').select('together_since').eq('id', order.couple_id).maybeSingle()
    const year = couple?.together_since ? new Date(couple.together_since).getUTCFullYear() : null
    return new ImageResponse(<Names a={from} b={to} year={year} w={w} h={h} product={order.product_key} />, {
      width: w, height: h, fonts: await loadFonts(), headers: { 'Cache-Control': 'private, no-store' },
    })
  }

  const body = side === 'front' ? (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: PAPER, padding: SAFE }}>
      <div style={{ fontFamily: 'Caveat', fontSize: 130, color: MUTED }}>for</div>
      <div style={{ fontFamily: 'Instrument Serif', fontSize: to.length > 9 ? 240 : 330, color: INK, lineHeight: 1, marginTop: 10, textAlign: 'center' }}>{to}</div>
      <div style={{ display: 'flex', marginTop: 90 }}><Heart size={300} /></div>
      <div style={{ fontFamily: 'Caveat', fontSize: 110, color: MUTED, marginTop: 120 }}>{`love, ${from}`}</div>
    </div>
  ) : (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: PAPER, padding: SAFE + 40 }}>
      <div style={{ fontFamily: 'Caveat', fontSize: 120, color: INK }}>{`${to},`}</div>
      <div style={{ fontFamily: 'Caveat', fontSize: noteSize(order.note), color: INK, lineHeight: 1.25, marginTop: 50, whiteSpace: 'pre-wrap', display: 'flex' }}>
        {order.note?.trim() || 'Thinking of you, always.'}
      </div>
      <div style={{ fontFamily: 'Caveat', fontSize: 120, color: INK, marginTop: 70, alignSelf: 'flex-end' }}>{`— ${from}`}</div>
      <div style={{ flex: 1, display: 'flex' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, fontFamily: 'Instrument Serif', fontSize: 48, color: MUTED }}>
        <Heart size={56} />
        <span>sent with Hiranda</span>
      </div>
    </div>
  )

  return new ImageResponse(body, {
    width: W,
    height: H,
    fonts: await loadFonts(),
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

// Shrink long notes so all 300 characters fit on the card.
function noteSize(note: string | null) {
  const n = note?.length ?? 0
  return n > 220 ? 108 : n > 140 ? 120 : 132
}

// A retro instant print: the photo square near the top, a deep white border
// at the bottom with the caption handwritten in it.
function Polaroid({ photo, w, h }: { photo: PrintPhoto; w: number; h: number }) {
  const side = Math.round(w * 0.06)
  const size = w - side * 2
  return (
    <div style={{ width: w, height: h, display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fbfaf7', paddingTop: side }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={photo.url} width={size} height={size} style={{ objectFit: 'cover' }} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: `0 ${side}px`, fontFamily: 'Caveat', fontSize: Math.round(w * 0.075), color: INK, textAlign: 'center', lineHeight: 1.1 }}>
        {photo.caption}
      </div>
    </div>
  )
}

type Fonts = Awaited<ReturnType<typeof loadFonts>>

// The book: a cover with your names, then one photo a page with its caption,
// padded with blank pages to the page count ordered from Gelato. Rendered as
// PNGs at w×h and wrapped into a PDF at 300 dpi.
async function bookPdf({ a, b, year, photos, w, h, fonts }: { a: string; b: string; year: number | null; photos: PrintPhoto[]; w: number; h: number; fonts: Fonts }) {
  const pdf = await PDFDocument.create()
  const pt = (px: number) => (px * 72) / 300
  const add = async (node: React.ReactElement) => {
    const png = await new ImageResponse(node, { width: w, height: h, fonts }).arrayBuffer()
    const img = await pdf.embedPng(png)
    pdf.addPage([pt(w), pt(h)]).drawImage(img, { x: 0, y: 0, width: pt(w), height: pt(h) })
  }
  const u = Math.min(w, h) / 100

  await add(
    <div style={{ width: w, height: h, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: PAPER }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={photos[0].url} width={Math.round(w * 0.56)} height={Math.round(w * 0.56)} style={{ objectFit: 'cover', borderRadius: u }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: u * 2.5, marginTop: u * 7, fontFamily: 'Instrument Serif', fontSize: u * 9, color: INK, lineHeight: 1 }}>
        <span>{a}</span><span style={{ fontFamily: 'Caveat', color: MUTED, fontSize: u * 7 }}>&</span><span>{b}</span>
      </div>
      {year && <div style={{ fontFamily: 'Caveat', fontSize: u * 5, color: MUTED, marginTop: u * 2 }}>{`since ${year}`}</div>}
    </div>,
  )
  for (const photo of photos) {
    await add(
      <div style={{ width: w, height: h, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: PAPER, padding: u * 9 }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={photo.url} width={Math.round(u * 82)} height={Math.round(u * 70)} style={{ objectFit: 'contain' }} />
        {photo.caption && <div style={{ marginTop: u * 4, fontFamily: 'Caveat', fontSize: u * 5, color: INK, textAlign: 'center' }}>{photo.caption}</div>}
      </div>,
    )
  }
  for (let i = photos.length; i < bookPages(photos.length); i++) {
    await add(<div style={{ width: w, height: h, display: 'flex', background: PAPER }} />)
  }
  return new Response(new Uint8Array(await pdf.save()), {
    headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'private, no-store' },
  })
}
