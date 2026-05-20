import Link from 'next/link'
import { Puzzle, Play, Users, Zap } from 'lucide-react'

export default function ExtensionPage() {
  return (
    <div className="px-4 pt-8 max-w-2xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-2">
        <Puzzle size={28} className="text-amber-600" />
        <h2 className="font-serif text-3xl text-amber-100">Hiranda Party</h2>
      </div>
      <p className="text-stone-500 mb-10">Watch Netflix, YouTube, Disney+, and more — perfectly in sync with your partner.</p>

      <div className="flex flex-col gap-4 mb-10">
        <Step n={1} icon={<Puzzle size={18} className="text-amber-500" />} title="Install the extension">
          Add Hiranda Party to Chrome or Firefox. One click — no account required for install.
        </Step>
        <Step n={2} icon={<Play size={18} className="text-amber-500" />} title="Start a party">
          Open Netflix (or any supported platform), hit the Hiranda icon, and tap <strong className="text-amber-200">Start Party</strong>. You'll get a share link.
        </Step>
        <Step n={3} icon={<Users size={18} className="text-amber-500" />} title="Send the link">
          Your partner opens the link, the extension connects automatically, and every play, pause, and seek stays in sync.
        </Step>
        <Step n={4} icon={<Zap size={18} className="text-amber-500" />} title="Chat while you watch">
          Use this page — your <span className="text-amber-300">party session</span> in Hiranda — for live chat and emotes while the video plays in your streaming tab.
        </Step>
      </div>

      <div className="flex flex-col gap-3 mb-10">
        <a
          href="#"
          className="flex items-center justify-center gap-3 bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium rounded-xl px-6 py-4 transition-colors opacity-60 cursor-not-allowed"
          aria-disabled="true"
        >
          <Puzzle size={18} /> Add to Chrome — coming soon
        </a>
        <a
          href="#"
          className="flex items-center justify-center gap-3 bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium rounded-xl px-6 py-4 transition-colors opacity-60 cursor-not-allowed"
          aria-disabled="true"
        >
          <Puzzle size={18} /> Add to Firefox — coming soon
        </a>
      </div>

      <div className="bg-stone-900/60 border border-stone-800/60 rounded-2xl p-5">
        <p className="text-stone-400 text-sm font-medium mb-3">Supported platforms</p>
        <div className="flex flex-wrap gap-2">
          {['Netflix', 'YouTube', 'Disney+', 'Prime Video', 'Max', 'Hulu', 'Apple TV+', 'Paramount+'].map(p => (
            <span key={p} className="text-xs bg-stone-800 text-stone-400 px-3 py-1.5 rounded-full">{p}</span>
          ))}
        </div>
      </div>

      <p className="text-stone-600 text-xs text-center mt-8">
        Already started a party?{' '}
        <Link href="/watch" className="text-amber-600 hover:text-amber-500 transition-colors">
          Go to Watch
        </Link>
      </p>
    </div>
  )
}

function Step({ n, icon, title, children }: { n: number; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 bg-stone-900/60 border border-stone-800/60 rounded-xl p-4">
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <span className="w-7 h-7 rounded-full bg-stone-800 flex items-center justify-center text-stone-500 text-xs font-bold">{n}</span>
        {icon}
      </div>
      <div>
        <p className="text-amber-100 font-medium mb-1">{title}</p>
        <p className="text-stone-500 text-sm leading-relaxed">{children}</p>
      </div>
    </div>
  )
}
