import { History, Zap, Coins, Heart } from 'lucide-react'

export type LogEvent = {
  key: string
  emoji?: string
  text: string
  chips: { label: string; tone: 'xp' | 'coin' | 'life' }[]
  when: string
}

function ago(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

const TONE = {
  xp: { cls: 'text-indigo-300', Icon: Zap },
  coin: { cls: 'text-amber-300', Icon: Coins },
  life: { cls: 'text-red-400', Icon: Heart },
}

export default function ActivityLog({ events }: { events: LogEvent[] }) {
  return (
    <div className="rounded-2xl bg-stone-900/70 border border-stone-800 p-4">
      <div className="flex items-center gap-1.5 mb-3"><History size={13} className="text-stone-400" /><h2 className="text-stone-400 text-xs uppercase tracking-widest">Activity</h2></div>
      {events.length === 0 ? (
        <p className="text-stone-600 text-sm">Nothing yet — play a set to see your gains here.</p>
      ) : (
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {events.map(e => (
            <div key={e.key} className="flex items-center gap-2.5">
              <span className="text-base w-5 text-center shrink-0">{e.emoji ?? '•'}</span>
              <span className="text-stone-300 text-sm flex-1 min-w-0 truncate">{e.text}</span>
              {e.chips.map((c, i) => {
                const { cls, Icon } = TONE[c.tone]
                return <span key={i} className={`inline-flex items-center gap-0.5 text-xs shrink-0 ${cls}`}><Icon size={11} />{c.label}</span>
              })}
              <span className="text-stone-600 text-[11px] shrink-0 w-7 text-right">{ago(e.when)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
