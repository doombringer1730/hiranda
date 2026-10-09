import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// The link-preview card for Hiranda's public pages (welcome tour, demo): the
// daily question on a taped paper card, in the app's own serif and hand fonts.
export const ogSize = { width: 1200, height: 630 }

export async function ogCard(line: string) {
  const [serif, hand] = await Promise.all([
    readFile(join(process.cwd(), 'assets/fonts/InstrumentSerif-Regular.ttf')),
    readFile(join(process.cwd(), 'assets/fonts/Caveat-Medium.ttf')),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 64,
          padding: '0 80px',
          background: 'radial-gradient(ellipse at 30% 100%, #3b2410 0%, #1c1917 70%)',
          color: '#fef3c7',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', width: 470 }}>
          <div style={{ display: 'flex', fontFamily: 'Serif', fontSize: 112, lineHeight: 1 }}>
            Hiranda<span style={{ color: '#f59e0b' }}>.</span>
          </div>
          <div style={{ display: 'flex', fontFamily: 'Serif', fontSize: 46, lineHeight: 1.1, marginTop: 18 }}>
            A private little place for the two of you.
          </div>
          <div style={{ display: 'flex', fontFamily: 'Hand', fontSize: 38, lineHeight: 1.15, marginTop: 22, color: '#fbbf24' }}>
            {line}
          </div>
        </div>

        <div
          style={{
            position: 'relative', display: 'flex', flexDirection: 'column', width: 540,
            padding: '44px 40px 36px', background: '#f7f1e6', color: '#2b2620',
            borderRadius: 6, transform: 'rotate(-2.5deg)',
            boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6)',
          }}
        >
          <div style={{ position: 'absolute', top: -18, left: 60, width: 150, height: 36, background: 'rgba(214,196,160,0.85)', transform: 'rotate(-6deg)', display: 'flex' }} />
          <div style={{ display: 'flex', fontSize: 18, letterSpacing: 5, color: '#6e655a' }}>TODAY’S QUESTION</div>
          <div style={{ display: 'flex', fontFamily: 'Serif', fontSize: 46, lineHeight: 1.1, marginTop: 10 }}>
            Would you rather live by the beach, or in the mountains?
          </div>
          <div style={{ display: 'flex', fontFamily: 'Hand', fontSize: 34, marginTop: 22, color: '#9a4a2f' }}>
            Riley: the mountains, obviously
          </div>
          <div style={{ display: 'flex', fontFamily: 'Hand', fontSize: 34, color: '#9a4a2f' }}>
            Sam: …a cabin, then?
          </div>
        </div>
      </div>
    ),
    {
      ...ogSize,
      fonts: [
        { name: 'Serif', data: serif, style: 'normal', weight: 400 },
        { name: 'Hand', data: hand, style: 'normal', weight: 500 },
      ],
    },
  )
}
