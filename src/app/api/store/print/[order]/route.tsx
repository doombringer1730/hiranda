import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/admin'
import { MAX_ART, printSignatureOk } from '@/lib/store/print'

// Print files for gifts, fetched by print partners. Links are signed (see
// lib/store/print.ts).
//   front / back — a flat A5 card with 4 mm bleed at 300 dpi (Gelato):
//                  "for <name>" and the sender's note.
//   design       — the couple's names and year, at the size the product
//                  asks for (blankets, mugs… via Printful / Printify).

const W = 1843
const H = 2575
const SAFE = 150 // keep words well inside the trim

const PAPER = '#f6efe3'
const INK = '#3b2f2a'
const MUTED = '#8a7a6e'
const ROSE = '#c0596b'

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 500; style: 'normal' }[]> | null = null
const loadFonts = () => fonts ??= Promise.all([
  readFile(join(process.cwd(), 'assets/fonts/Caveat-Medium.ttf')).then(data => ({ name: 'Caveat', data, weight: 500 as const, style: 'normal' as const })),
  readFile(join(process.cwd(), 'assets/fonts/InstrumentSerif-Regular.ttf')).then(data => ({ name: 'Instrument Serif', data, weight: 400 as const, style: 'normal' as const })),
])

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
    .select('note, sender_id, recipient_id, status, couple_id').eq('id', orderId).maybeSingle()
  if (!order || !['paid', 'fulfilling', 'shipped'].includes(order.status)) return new Response('Not found', { status: 404 })
  const { data: people } = await db.from('profiles').select('id, display_name').in('id', [order.sender_id, order.recipient_id])
  const name = (id: string) => firstName(people?.find(p => p.id === id)?.display_name)
  const from = name(order.sender_id) || 'me'
  const to = name(order.recipient_id) || 'you'

  const heart = (size: number) => (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <path d="M50 86 C 20 64, 6 46, 14 28 C 22 12, 44 14, 50 32 C 56 14, 78 12, 86 28 C 94 46, 80 64, 50 86 Z"
        fill="none" stroke={ROSE} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )

  if (side === 'design') {
    const { data: couple } = await db.from('couple').select('together_since').eq('id', order.couple_id).maybeSingle()
    const year = couple?.together_since ? new Date(couple.together_since).getUTCFullYear() : null
    return new ImageResponse(<Names a={from} b={to} year={year} w={w} h={h} />, {
      width: w, height: h, fonts: await loadFonts(), headers: { 'Cache-Control': 'private, no-store' },
    })
  }

  const body = side === 'front' ? (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: PAPER, padding: SAFE }}>
      <div style={{ fontFamily: 'Caveat', fontSize: 130, color: MUTED }}>for</div>
      <div style={{ fontFamily: 'Instrument Serif', fontSize: to.length > 9 ? 240 : 330, color: INK, lineHeight: 1, marginTop: 10, textAlign: 'center' }}>{to}</div>
      <div style={{ display: 'flex', marginTop: 90 }}>{heart(300)}</div>
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
        {heart(56)}
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

// "Sam & Riley · since 2023" — scales with the print area.
function Names({ a, b, year, w, h }: { a: string; b: string; year: number | null; w: number; h: number }) {
  const u = Math.min(w, h) / 100
  const long = `${a}${b}`.length > 12
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: PAPER }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: u * 3, fontFamily: 'Instrument Serif', fontSize: u * (long ? 11 : 14), color: INK, lineHeight: 1 }}>
        <span>{a}</span>
        <span style={{ fontFamily: 'Caveat', color: ROSE, fontSize: u * (long ? 9 : 11) }}>&</span>
        <span>{b}</span>
      </div>
      <div style={{ display: 'flex', marginTop: u * 4 }}>
        <svg width={u * 9} height={u * 9} viewBox="0 0 100 100">
          <path d="M50 86 C 20 64, 6 46, 14 28 C 22 12, 44 14, 50 32 C 56 14, 78 12, 86 28 C 94 46, 80 64, 50 86 Z"
            fill="none" stroke={ROSE} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {year && <div style={{ fontFamily: 'Caveat', fontSize: u * 6, color: MUTED, marginTop: u * 3 }}>{`since ${year}`}</div>}
    </div>
  )
}

// Shrink long notes so all 300 characters fit on the card.
function noteSize(note: string | null) {
  const n = note?.length ?? 0
  return n > 220 ? 108 : n > 140 ? 120 : 132
}
