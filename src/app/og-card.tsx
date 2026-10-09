import { ImageResponse } from 'next/og'

// The link-preview card for Hiranda's public pages (welcome tour, demo).
export const ogSize = { width: 1200, height: 630 }

export function ogCard(line: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', padding: '0 96px',
          background: 'radial-gradient(ellipse at 50% 100%, #3b2410 0%, #1c1917 70%)',
          color: '#fef3c7',
        }}
      >
        <div style={{ display: 'flex', fontSize: 120, fontFamily: 'serif', letterSpacing: -2 }}>
          Hiranda<span style={{ color: '#f59e0b' }}>.</span>
        </div>
        <div style={{ display: 'flex', fontSize: 52, marginTop: 16, color: '#fde68a' }}>
          A private little place for the two of you.
        </div>
        <div style={{ display: 'flex', fontSize: 34, marginTop: 40, color: '#a8a29e' }}>{line}</div>
      </div>
    ),
    ogSize,
  )
}
