import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Shared artwork for gift print files (api/store/print) and the public
// "see it with your names" previews (api/store/preview).

export const PAPER = '#f6efe3'
export const INK = '#3b2f2a'
export const MUTED = '#8a7a6e'
export const ROSE = '#c0596b'

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 500; style: 'normal' }[]> | null = null
export const loadFonts = () => fonts ??= Promise.all([
  readFile(join(process.cwd(), 'assets/fonts/Caveat-Medium.ttf')).then(data => ({ name: 'Caveat', data, weight: 500 as const, style: 'normal' as const })),
  readFile(join(process.cwd(), 'assets/fonts/InstrumentSerif-Regular.ttf')).then(data => ({ name: 'Instrument Serif', data, weight: 400 as const, style: 'normal' as const })),
])

export function Heart({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <path d="M50 86 C 20 64, 6 46, 14 28 C 22 12, 44 14, 50 32 C 56 14, 78 12, 86 28 C 94 46, 80 64, 50 86 Z"
        fill="none" stroke={ROSE} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Per-product looks. The mug is white, with the names twice — on each side,
 *  so whoever holds it sees them while drinking, left- or right-handed (the
 *  wrap's middle faces away from the handle, its quarters face the sides). */
export const DESIGNS: Record<string, { bg?: string; sides?: boolean }> = {
  mug: { bg: '#ffffff', sides: true },
}

// "Sam & Riley · since 2023" — scales with the print area.
export function Names({ a, b, year, w, h, product }: { a: string; b: string; year: number | null; w: number; h: number; product?: string }) {
  const look = (product && DESIGNS[product]) || {}
  const bg = look.bg ?? PAPER
  if (look.sides) return (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: bg }}>
      <NamesBlock a={a} b={b} year={year} w={w / 2} h={h} bg={bg} />
      <NamesBlock a={a} b={b} year={year} w={w / 2} h={h} bg={bg} />
    </div>
  )
  return <NamesBlock a={a} b={b} year={year} w={w} h={h} bg={bg} />
}

function NamesBlock({ a, b, year, w, h, bg }: { a: string; b: string; year: number | null; w: number; h: number; bg: string }) {
  const u = Math.min(w, h) / 100
  const long = `${a}${b}`.length > 12
  return (
    <div style={{ width: w, height: h, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: bg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: u * 3, fontFamily: 'Instrument Serif', fontSize: u * (long ? 11 : 14), color: INK, lineHeight: 1 }}>
        <span>{a}</span>
        <span style={{ fontFamily: 'Caveat', color: ROSE, fontSize: u * (long ? 9 : 11) }}>&</span>
        <span>{b}</span>
      </div>
      <div style={{ display: 'flex', marginTop: u * 4 }}><Heart size={u * 9} /></div>
      {year && <div style={{ fontFamily: 'Caveat', fontSize: u * 6, color: MUTED, marginTop: u * 3 }}>{`since ${year}`}</div>}
    </div>
  )
}
