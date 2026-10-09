import { ImageResponse } from 'next/og'
import { builtInProduct } from '@/lib/store/catalog'
import { Names, loadFonts } from '@/lib/store/print-art'

// "See it with your names": the names design for a built-in keepsake, e.g.
//   /api/store/preview/blanket?a=Sam&b=Riley&year=2023
// Public and unsigned, so it only draws the shared design (no order data),
// with short names, at a capped size. Also what print partners' mockup
// generators fetch to photograph our products.

const MAX_SIDE = 1800
const NAME = /^[\p{L}][\p{L}' .-]{0,15}$/u

export async function GET(request: Request, { params }: { params: Promise<{ product: string }> }) {
  const { product: key } = await params
  const product = builtInProduct(key)
  const v = product?.vendor
  const art = v && (v.name === 'printful' || v.name === 'printify') ? v.art : null
  if (!art) return new Response('Not found', { status: 404 })

  const q = new URL(request.url).searchParams
  const a = (q.get('a') ?? 'You').trim()
  const b = (q.get('b') ?? 'Me').trim()
  const y = q.get('year')
  if (!NAME.test(a) || !NAME.test(b) || (y && !/^(19|20)\d\d$/.test(y))) return new Response('Bad request', { status: 400 })

  const scale = Math.min(1, MAX_SIDE / Math.max(art.w, art.h))
  const w = Math.round(art.w * scale)
  const h = Math.round(art.h * scale)
  return new ImageResponse(<Names a={a} b={b} year={y ? Number(y) : null} w={w} h={h} product={key} />, {
    width: w, height: h, fonts: await loadFonts(),
    headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable' },
  })
}
