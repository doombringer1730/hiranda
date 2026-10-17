import Link from 'next/link'
import { type Access, type Done, type Route, routeState } from '@/lib/grow-map'
import RouteActions from './route-actions'

// The map: a sheet of paper taped to the page. Base camp's three loops at the
// top, then a fork of dotted ink trails, one per branch. Each stop is a stamp
// half in your color, half in theirs; it inks in fully once you've both been.
// "You are here" is a little pin with your face (and theirs, clipped together
// when you're at the same stop). Routes you can't open yet are pencil sketches,
// not locks. Nothing bounces, nothing nags.

type Person = { first: string; accent: string; avatar: string | null }

export default function TrailMap({ routes, done, me, partner, meId, partnerId, accessOf }: {
  routes: Route[]
  done: Done
  me: Person
  partner: Person
  meId: string
  partnerId: string
  accessOf: (route: Route) => Access
}) {
  const base = routes.filter(r => r.kind === 'base')
  const branches = routes.filter(r => r.kind === 'branch')
  return (
    <div className="paper rounded-[8px] px-4 pt-7 pb-6 relative -rotate-[0.3deg]">
      <span className="tape -top-3 left-8 -rotate-6" />
      <span className="tape -top-3 right-10 rotate-3" />

      <div className="flex items-center justify-between">
        <p className="font-hand text-[26px] leading-none text-[var(--paper-ink)]">our map</p>
        <p className="flex items-center gap-3 text-[11px] text-[var(--paper-muted)]">
          <Dot color={me.accent} /> you <Dot color={partner.accent} /> {partner.first}
        </p>
      </div>

      <p className="mt-5 text-[10px] uppercase tracking-[0.22em] text-[var(--paper-muted)]">Base camp · start anywhere</p>
      <div className="mt-2 flex flex-col gap-1">
        {base.map(r => <RouteRow key={r.key} route={r} {...{ done, me, partner, meId, partnerId }} access={accessOf(r)} />)}
      </div>

      {/* the fork: ink trails leaving base camp */}
      <svg viewBox="0 0 320 54" className="w-full h-12 my-1 text-[var(--paper-ink)]" aria-hidden>
        <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2 5" strokeLinecap="round" opacity=".45">
          <path d="M160 2 C160 20, 60 22, 40 52" />
          <path d="M160 2 C160 24, 130 30, 120 52" />
          <path d="M160 2 C160 24, 190 30, 200 52" />
          <path d="M160 2 C160 20, 260 22, 280 52" />
        </g>
      </svg>

      <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--paper-muted)]">Branches · pick the ones that fit you two</p>
      <div className="mt-2 flex flex-col gap-1">
        {branches.map(r => <RouteRow key={r.key} route={r} {...{ done, me, partner, meId, partnerId }} access={accessOf(r)} />)}
      </div>
    </div>
  )
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
}

function RouteRow({ route, done, me, partner, meId, partnerId, access }: {
  route: Route; done: Done; me: Person; partner: Person; meId: string; partnerId: string; access: Access
}) {
  const open = access === 'open'
  // A hard topic waiting on a mutual yes: the row itself isn't a link.
  const waiting = access === 'suggest' || access === 'you-suggested' || access === 'they-suggested'
  const st = routeState(route, done, meId, partnerId)
  const theirs = routeState(route, done, partnerId, meId)
  const href = open ? `/grow/lesson/${(st.next ?? route.stops[route.stops.length - 1]).key}` : '/plus'
  const label = waiting ? (access === 'they-suggested' ? 'suggested' : 'together, or not at all')
    : !open ? 'with Plus'
    : st.finished ? 'walked together ✓'
    : st.started ? `${st.both} of ${st.total} together`
    : route.free ? 'always free' : `${st.total} stops`

  const Row = waiting ? 'div' : Link
  return (
    <div className={`rounded-xl px-2 py-2.5 -mx-2 ${open || waiting ? '' : 'opacity-60'}`}>
    <Row href={href} className={`group block ${waiting ? '' : 'transition-colors hover:bg-[rgb(43_38_32/0.05)] rounded-lg'}`}>
      <div className="flex items-baseline gap-2">
        <span className="text-lg leading-none" aria-hidden>{route.emoji}</span>
        <span className="font-serif text-[19px] leading-tight text-[var(--paper-ink)]">{route.title}</span>
        <span className="ml-auto shrink-0 text-[11px] text-[var(--paper-muted)]">{label}</span>
      </div>
      <p className="text-[12px] text-[var(--paper-muted)] mt-0.5 ml-7">{route.blurb}</p>

      {/* the trail: stamps joined by a dotted ink line */}
      <div className="relative mt-0.5 ml-7 flex items-center gap-2 overflow-x-auto no-scrollbar pt-5 pb-1">
        <span className="absolute left-3 right-3 top-[35px] border-t-[1.5px] border-dotted border-[rgb(43_38_32/0.35)]" aria-hidden />
        {route.stops.map(s => {
          const by = done.get(s.key)
          const mine = !!by?.has(meId), them = !!by?.has(partnerId)
          // Pins only on routes you're walking, so the map isn't covered in faces.
          const hereMe = open && st.started && st.next?.key === s.key
          const hereThem = open && st.started && theirs.next?.key === s.key
          const bg = mine && them ? route.color
            : mine || them ? `conic-gradient(${mine ? me.accent : 'transparent'} 0 50%, ${them ? partner.accent : 'transparent'} 50% 100%)`
            : 'transparent'
          return (
            <span key={s.key} className="relative shrink-0 grid place-items-center" title={s.title}>
              <span
                className={`relative grid place-items-center h-[30px] w-[30px] rounded-full ${mine || them ? '' : open ? 'border-[1.5px] border-dashed border-[rgb(43_38_32/0.45)]' : 'border border-dashed border-[rgb(43_38_32/0.25)]'}`}
                style={{ background: bg, boxShadow: mine && them ? 'inset 0 0 0 2px rgb(255 255 255 / .35)' : undefined }}
              >
                {mine && them && <span className="text-[13px] text-white">✓</span>}
              </span>
              {(hereMe || hereThem) && (
                <span className="absolute -top-[18px] flex -space-x-1.5" aria-label={hereMe && hereThem ? 'you’re both here' : hereMe ? 'you are here' : `${partner.first} is here`}>
                  {hereMe && <Pin p={me} />}
                  {hereThem && <Pin p={partner} />}
                </span>
              )}
            </span>
          )
        })}
      </div>
    </Row>
    {waiting && <RouteActions routeKey={route.key} access={access} partner={partner.first} />}
    </div>
  )
}

function Pin({ p }: { p: Person }) {
  return (
    <span className="grid place-items-center h-[18px] w-[18px] rounded-full overflow-hidden ring-2 ring-[var(--paper)] text-[9px] font-semibold text-white" style={{ background: p.accent }}>
      {p.avatar
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={p.avatar} alt="" className="h-full w-full object-cover" />
        : p.first.slice(0, 1).toUpperCase()}
    </span>
  )
}
