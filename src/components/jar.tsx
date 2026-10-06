// A glass jar that fills with folded paper slips. `slips` are colours, one per
// slip (oldest first); positions are stable so the jar doesn't reshuffle.

function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

export function Jar({ slips, size = 180, shake = false, label }: { slips: string[]; size?: number; shake?: boolean; label?: string }) {
  const shown = slips.slice(-40)
  // Fill from the bottom in loose rows of five.
  const pieces = shown.map((color, i) => {
    const row = Math.floor(i / 4), col = i % 4
    const x = 46 + col * 27 + (rand(i + 1) - 0.5) * 10
    const y = 194 - row * 15 - rand(i + 7) * 5
    const r = (rand(i + 3) - 0.5) * 70
    return { color, x, y, r }
  })
  return (
    <svg viewBox="0 0 180 220" width={size} height={size * 220 / 180} role="img" aria-label={label ?? `A jar with ${slips.length} notes`} className={shake ? 'animate-jar-shake' : ''}>
      {/* lid */}
      <rect x="44" y="12" width="92" height="20" rx="6" fill="var(--color-amber-700)" />
      <rect x="44" y="12" width="92" height="7" rx="4" fill="rgb(255 255 255 / 0.18)" />
      {/* glass */}
      <path d="M50 32 h80 v10 c0 6 18 10 18 30 v118 c0 14 -10 22 -24 22 h-68 c-14 0 -24 -8 -24 -22 v-118 c0 -20 18 -24 18 -30 z"
        fill="rgb(255 255 255 / 0.05)" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2.5" className="text-stone-300" />
      {/* slips */}
      <g>
        {pieces.map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.r})`}>
            <rect x="-14" y="-7" width="28" height="14" rx="2" fill={p.color} />
            <line x1="-14" y1="0" x2="14" y2="0" stroke="rgb(0 0 0 / 0.12)" strokeWidth="1" />
          </g>
        ))}
      </g>
      {/* shine */}
      <path d="M44 80 c-4 20 -4 70 0 100" stroke="rgb(255 255 255 / 0.22)" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M56 70 c-2 6 -2 14 0 18" stroke="rgb(255 255 255 / 0.18)" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export const SLIP_ME = '#f6e7c8'
export const SLIP_PARTNER = '#f4c9d6'
