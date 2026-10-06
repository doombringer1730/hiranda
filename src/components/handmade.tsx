// Analogue touches: ink scribbles and polaroids. Styles live in globals.css
// under "Handmade layer".

type ScribbleKind = 'underline' | 'circle' | 'heart' | 'arrow'

// Hand-drawn paths, slightly wobbly on purpose. pathLength=1 lets the CSS
// draw them in with one dash animation whatever their real length.
const PATHS: Record<ScribbleKind, { viewBox: string; d: string }> = {
  underline: { viewBox: '0 0 200 16', d: 'M3 11 C 40 5, 80 13, 120 8 S 180 6, 197 9' },
  circle: { viewBox: '0 0 200 80', d: 'M120 6 C 60 2, 8 16, 6 40 C 4 66, 70 76, 120 73 C 170 70, 196 54, 193 36 C 190 14, 140 4, 96 8' },
  heart: { viewBox: '0 0 40 36', d: 'M20 33 C 6 23, 2 15, 4 9 C 6 3, 15 1, 20 9 C 25 1, 34 3, 36 9 C 38 16, 33 24, 20 33' },
  arrow: { viewBox: '0 0 60 40', d: 'M4 6 C 20 6, 38 14, 50 32 M40 30 L 51 33 L 53 21' },
}

export function Scribble({ kind, className = '', strokeWidth = 2.5 }: { kind: ScribbleKind; className?: string; strokeWidth?: number }) {
  const { viewBox, d } = PATHS[kind]
  return (
    <svg viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true" className={`scribble pointer-events-none ${className}`}>
      <path d={d} pathLength={1} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// A polaroid with a handwritten caption and an optional strip of tape.
export function Polaroid({ src, caption, sub, tilt = -2, tape = true, className = '' }: {
  src: string | null
  caption: string
  sub?: string | null
  tilt?: number
  tape?: boolean
  className?: string
}) {
  return (
    <figure className={`polaroid ${className}`} style={{ rotate: `${tilt}deg` }}>
      {tape && <span className="tape -top-3 left-1/2 -translate-x-1/2 rotate-[-4deg]" />}
      <div className="aspect-square overflow-hidden rounded-[2px] bg-stone-300">
        {src
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={src} alt="" className="h-full w-full object-cover" />
          : <div className="h-full w-full grid place-items-center bg-[#ece6da] text-[#b4a993] font-serif text-5xl">H.</div>}
      </div>
      <figcaption className="px-1 pt-1.5 pb-2.5 text-[#2b2620]">
        <p className="font-hand text-[22px] leading-[1.05] line-clamp-2">{caption}</p>
        {sub && <p className="text-[10px] uppercase tracking-[0.18em] text-[#8a7f70] mt-0.5">{sub}</p>}
      </figcaption>
    </figure>
  )
}
