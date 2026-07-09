'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, Layers, Zap, Grid3x3, RotateCcw, Check, X, Trophy, Clock,
  Keyboard, Brain, ClipboardList,
} from 'lucide-react'
import { addCard, addCardsBulk, updateCard, deleteCard, deleteDeck, recordAttempt, reviewCard } from '../actions'

type Card = { id: string; term: string; definition: string; position: number }
type Best = { correct: number; total: number } | null
type Mode = 'overview' | 'flash' | 'quiz' | 'match' | 'review' | 'write' | 'learn'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}

export default function DeckClient({ deck, cards, dueCount, myBest, partnerBest, partnerName }: {
  deck: { id: string; title: string; description: string | null }
  cards: Card[]
  dueCount: number
  myBest: Best
  partnerBest: Best
  partnerName: string | null
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('overview')
  const done = () => { setMode('overview'); router.refresh() }

  if (mode === 'flash') return <Flashcards cards={cards} onExit={() => setMode('overview')} />
  if (mode === 'quiz') return <Quiz deckId={deck.id} cards={cards} myBest={myBest} onExit={done} />
  if (mode === 'match') return <Match deckId={deck.id} cards={cards} onExit={done} />
  if (mode === 'review') return <Review deckId={deck.id} cards={cards} onExit={done} />
  if (mode === 'write') return <Write deckId={deck.id} cards={cards} onExit={done} />
  if (mode === 'learn') return <Learn deckId={deck.id} cards={cards} onExit={done} />

  const enough = cards.length >= 4
  return (
    <div className="px-4 pt-4 pb-8 max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <Link href="/study" className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-300 text-sm transition-colors mb-3">
          <ArrowLeft size={15} /> Study
        </Link>
        <h1 className="font-serif text-3xl text-amber-100">{deck.title}</h1>
        {deck.description && <p className="text-stone-400 text-sm mt-1">{deck.description}</p>}
      </div>

      {/* Head-to-head */}
      {(myBest || partnerBest) && (
        <div className="rounded-2xl bg-stone-900/70 border border-stone-800 p-4 flex items-center gap-6">
          <Trophy size={16} className="text-amber-500 shrink-0" />
          <span className="text-sm text-stone-400">Your best <b className="text-amber-200">{myBest ? `${myBest.correct}/${myBest.total}` : '—'}</b></span>
          {partnerName && <span className="text-sm text-stone-400">{partnerName} <b className="text-amber-200">{partnerBest ? `${partnerBest.correct}/${partnerBest.total}` : '—'}</b></span>}
        </div>
      )}

      {/* Modes — ordered by learning effectiveness (recall-first) */}
      <div className="grid grid-cols-2 gap-3">
        <ModeButton icon={Brain} label="Learn" hint={enough ? 'adaptive · masters weak cards' : 'add 4+ cards'} disabled={!enough} onClick={() => setMode('learn')} accent />
        <ModeButton icon={Keyboard} label="Write" hint={cards.length >= 1 ? 'type it · best recall · 3× XP' : 'add cards'} disabled={cards.length < 1} onClick={() => setMode('write')} accent />
        <ModeButton icon={Zap} label="Quiz" hint={enough ? 'timed multiple choice' : 'add 4+ cards'} disabled={!enough} onClick={() => setMode('quiz')} />
        <ModeButton icon={Grid3x3} label="Match" hint={enough ? 'beat the clock' : 'add 4+ cards'} disabled={!enough} onClick={() => setMode('match')} />
        <ModeButton icon={RotateCcw} label="Review" hint={dueCount > 0 ? `${dueCount} due now` : 'all caught up'} disabled={dueCount < 1} onClick={() => setMode('review')} badge={dueCount > 0 ? dueCount : undefined} />
        <ModeButton icon={Layers} label="Flashcards" hint={`${cards.length} card${cards.length !== 1 ? 's' : ''}`} disabled={cards.length < 1} onClick={() => setMode('flash')} />
      </div>

      <CardManager deckId={deck.id} cards={cards} />
    </div>
  )
}

function ModeButton({ icon: Icon, label, hint, onClick, disabled, accent, badge }: {
  icon: React.ElementType; label: string; hint: string; onClick: () => void; disabled?: boolean; accent?: boolean; badge?: number
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`relative flex flex-col gap-1 rounded-2xl p-4 text-left transition-colors border disabled:opacity-40 disabled:cursor-not-allowed card-glow ${
        accent ? 'bg-amber-900/20 border-amber-800/40 hover:border-amber-700/60' : 'bg-stone-900/70 border-stone-800 hover:border-amber-800/50'}`}>
      <Icon size={20} className={accent ? 'text-amber-400' : 'text-stone-300'} />
      <span className="text-amber-100 font-medium mt-1">{label}</span>
      <span className="text-stone-500 text-xs">{hint}</span>
      {badge !== undefined && <span className="absolute top-3 right-3 bg-amber-600 text-amber-50 text-[11px] font-medium rounded-full px-2 py-0.5">{badge}</span>}
    </button>
  )
}

// ────────────────────────── Card manager ──────────────────────────
// Parse pasted text into term/definition pairs. Each line is one card; the
// term/definition split is the first tab, " - ", " — ", " = " or ": ".
function parsePairs(text: string): { term: string; definition: string }[] {
  return text.split(/\r?\n/).map(line => {
    const m = line.match(/^(.*?)(?:\t| [—–-] | = |: |\|)(.*)$/)
    if (!m) return null
    return { term: m[1].trim(), definition: m[2].trim() }
  }).filter((p): p is { term: string; definition: string } => !!p && !!p.term && !!p.definition)
}

function CardManager({ deckId, cards }: { deckId: string; cards: Card[] }) {
  const router = useRouter()
  const [term, setTerm] = useState('')
  const [def, setDef] = useState('')
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [paste, setPaste] = useState('')
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const termRef = useRef<HTMLInputElement>(null)

  async function add() {
    if (!term.trim() || !def.trim()) return
    setBusy(true)
    await addCard(deckId, term, def)
    setTerm(''); setDef(''); setBusy(false)
    termRef.current?.focus()
    router.refresh()
  }

  const parsed = parsePairs(paste)
  async function doImport() {
    setBusy(true); setImportMsg(null)
    const res = await addCardsBulk(deckId, parsed)
    setBusy(false)
    if (res.error) { setImportMsg(res.error); return }
    setPaste(''); setImporting(false)
    router.refresh()
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-stone-500 text-xs uppercase tracking-widest">{cards.length} card{cards.length !== 1 ? 's' : ''}</h2>
        <button onClick={() => setImporting(v => !v)} className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-xs">
          <ClipboardList size={13} /> {importing ? 'Close import' : 'Paste to import'}
        </button>
      </div>

      {importing && (
        <div className="mb-4 rounded-2xl bg-stone-900/70 border border-stone-800 p-3 flex flex-col gap-2">
          <textarea
            value={paste} onChange={e => setPaste(e.target.value)} rows={5}
            placeholder={'Paste one card per line:\nhola - hello\nadiós - goodbye\ngato: cat'}
            className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-amber-50 placeholder:text-stone-600 text-sm focus:outline-none focus:border-indigo-500 resize-y" />
          <div className="flex items-center justify-between">
            <span className="text-stone-500 text-xs">{parsed.length} card{parsed.length !== 1 ? 's' : ''} detected · splits on tab, “-”, “:”, “=”</span>
            <button onClick={doImport} disabled={busy || !parsed.length}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-xl px-4 py-2 transition-colors">
              Import {parsed.length || ''}
            </button>
          </div>
          {importMsg && <p className="text-red-400 text-xs">{importMsg}</p>}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input ref={termRef} value={term} onChange={e => setTerm(e.target.value)} placeholder="Term"
          onKeyDown={e => { if (e.key === 'Enter') document.getElementById('def-input')?.focus() }}
          className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700" />
        <input id="def-input" value={def} onChange={e => setDef(e.target.value)} placeholder="Definition"
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700" />
        <button onClick={add} disabled={busy || !term.trim() || !def.trim()}
          className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 rounded-xl px-4 py-2.5 flex items-center justify-center transition-colors">
          <Plus size={18} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {cards.map(c => <CardRow key={c.id} card={c} deckId={deckId} />)}
      </div>

      <button
        onClick={() => { if (confirm('Delete this deck and all its cards? This can’t be undone.')) deleteDeck(deckId) }}
        className="mt-8 self-start inline-flex items-center gap-1.5 text-stone-500 hover:text-red-400 text-xs transition-colors"
      >
        <Trash2 size={13} /> Delete deck
      </button>
    </section>
  )
}

function CardRow({ card, deckId }: { card: Card; deckId: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [term, setTerm] = useState(card.term)
  const [def, setDef] = useState(card.definition)

  if (editing) {
    return (
      <div className="flex flex-col sm:flex-row gap-2 bg-stone-950/60 border border-stone-800 rounded-xl p-2">
        <input value={term} onChange={e => setTerm(e.target.value)} className="flex-1 bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-amber-50 text-sm" />
        <input value={def} onChange={e => setDef(e.target.value)} className="flex-1 bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-amber-50 text-sm" />
        <button onClick={async () => { await updateCard(card.id, deckId, term, def); setEditing(false); router.refresh() }}
          className="bg-amber-700 hover:bg-amber-600 text-amber-50 rounded-lg px-3 py-2 text-sm">Save</button>
      </div>
    )
  }
  return (
    <div className="group flex items-center gap-3 bg-stone-900/50 border border-stone-800 rounded-xl px-4 py-3">
      <span className="text-amber-100 text-sm flex-1 min-w-0 truncate">{card.term}</span>
      <span className="text-stone-500 text-sm flex-1 min-w-0 truncate">{card.definition}</span>
      <button onClick={() => setEditing(true)} className="text-stone-600 hover:text-amber-400 text-xs shrink-0">edit</button>
      <button onClick={async () => { await deleteCard(card.id, deckId); router.refresh() }} className="text-stone-600 hover:text-red-400 shrink-0"><Trash2 size={14} /></button>
    </div>
  )
}

// ────────────────────────── Flashcards ──────────────────────────
function Flashcards({ cards, onExit }: { cards: Card[]; onExit: () => void }) {
  const order = useMemo(() => shuffle(cards), [cards])
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const c = order[i]
  const next = (d: number) => { setFlipped(false); setI(p => Math.max(0, Math.min(order.length - 1, p + d))) }

  return (
    <ModeShell title="Flashcards" onExit={onExit} progress={`${i + 1} / ${order.length}`}>
      <button onClick={() => setFlipped(f => !f)}
        className="w-full min-h-[16rem] rounded-3xl bg-stone-900 border border-stone-800 flex items-center justify-center p-8 text-center card-glow">
        <div>
          <p className="text-stone-600 text-[10px] uppercase tracking-widest mb-3">{flipped ? 'definition' : 'term'}</p>
          <p className="font-serif text-2xl text-amber-100">{flipped ? c.definition : c.term}</p>
          <p className="text-stone-600 text-xs mt-6">tap to flip</p>
        </div>
      </button>
      <div className="flex gap-2 mt-4">
        <button onClick={() => next(-1)} disabled={i === 0} className="flex-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 rounded-xl py-3 text-sm">Previous</button>
        <button onClick={() => next(1)} disabled={i === order.length - 1} className="flex-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-amber-50 rounded-xl py-3 text-sm">Next</button>
      </div>
    </ModeShell>
  )
}

// ────────────────────────── Quiz (competitive) ──────────────────────────
const QUESTION_SECONDS = 15
function Quiz({ deckId, cards, myBest, onExit }: { deckId: string; cards: Card[]; myBest: Best; onExit: () => void }) {
  const questions = useMemo(() => shuffle(cards).slice(0, Math.min(10, cards.length)).map(card => {
    const distractors = shuffle(cards.filter(x => x.id !== card.id)).slice(0, 3).map(x => x.definition)
    return { card, options: shuffle([card.definition, ...distractors]) }
  }), [cards])

  const [qi, setQi] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [xp, setXp] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [left, setLeft] = useState(QUESTION_SECONDS)
  const [finished, setFinished] = useState(false)
  const startRef = useRef(Date.now())

  const q = questions[qi]

  useEffect(() => {
    if (picked || finished) return
    if (left <= 0) { choose(''); return }
    const t = setTimeout(() => setLeft(l => l - 1), 1000)
    return () => clearTimeout(t)
  }, [left, picked, finished])

  function choose(opt: string) {
    if (picked !== null) return
    setPicked(opt)
    const right = opt === q.card.definition
    if (right) {
      setCorrect(c => c + 1)
      setXp(x => x + 10 + (left > QUESTION_SECONDS / 2 ? 5 : 0)) // speed bonus
    }
  }
  function advance() {
    if (qi + 1 >= questions.length) {
      const finalXp = xp + (correct === questions.length ? 25 : 0) // perfect bonus
      setXp(finalXp)
      setFinished(true)
      recordAttempt(deckId, 'quiz', correct, questions.length, finalXp, Date.now() - startRef.current)
    } else {
      setQi(i => i + 1); setPicked(null); setLeft(QUESTION_SECONDS)
    }
  }

  if (finished) {
    const beat = myBest && correct / questions.length > myBest.correct / myBest.total
    return (
      <ModeShell title="Quiz" onExit={onExit}>
        <div className="text-center py-8">
          <p className="text-stone-500 text-xs uppercase tracking-widest">You scored</p>
          <p className="font-serif text-6xl text-amber-100 my-2">{correct}<span className="text-stone-600 text-3xl">/{questions.length}</span></p>
          <p className="text-amber-400 font-medium text-lg flex items-center justify-center gap-2"><Zap size={18} />+{xp} XP</p>
          {beat && <p className="text-amber-300 text-sm mt-3">🎉 New personal best!</p>}
          <div className="flex gap-2 mt-8">
            <button onClick={onExit} className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl py-3 text-sm">Done</button>
            <button onClick={() => location.reload()} className="flex-1 bg-amber-700 hover:bg-amber-600 text-amber-50 rounded-xl py-3 text-sm">Play again</button>
          </div>
        </div>
      </ModeShell>
    )
  }

  return (
    <ModeShell title="Quiz" onExit={onExit} progress={`${qi + 1} / ${questions.length}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-1.5 rounded-full bg-stone-800 overflow-hidden">
          <div className="h-full bg-amber-600 transition-all duration-1000 ease-linear" style={{ width: `${(left / QUESTION_SECONDS) * 100}%` }} />
        </div>
        <span className="text-stone-500 text-xs flex items-center gap-1"><Clock size={12} />{left}s</span>
      </div>
      <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 text-center mb-4">
        <p className="text-stone-600 text-[10px] uppercase tracking-widest mb-2">What matches</p>
        <p className="font-serif text-2xl text-amber-100">{q.card.term}</p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {q.options.map(opt => {
          const isRight = opt === q.card.definition
          const state = picked === null ? '' : isRight ? 'right' : picked === opt ? 'wrong' : 'dim'
          return (
            <button key={opt} onClick={() => choose(opt)} disabled={picked !== null}
              className={`w-full text-left rounded-xl px-4 py-3.5 border transition-colors ${
                state === 'right' ? 'bg-emerald-900/40 border-emerald-700 text-emerald-100'
                : state === 'wrong' ? 'bg-red-900/40 border-red-800 text-red-100'
                : state === 'dim' ? 'bg-stone-950/60 border-stone-800 text-stone-500'
                : 'bg-stone-950 border-stone-800 text-amber-50 hover:border-amber-700'}`}>
              <span className="flex items-center gap-2">
                {state === 'right' && <Check size={16} />}{state === 'wrong' && <X size={16} />}
                {opt}
              </span>
            </button>
          )
        })}
      </div>
      {picked !== null && (
        <button onClick={advance} className="w-full mt-4 bg-amber-700 hover:bg-amber-600 text-amber-50 rounded-xl py-3 text-sm font-medium">
          {qi + 1 >= questions.length ? 'See results' : 'Next'}
        </button>
      )}
    </ModeShell>
  )
}

// ────────────────────────── Write (type the answer — active recall) ──────────────────────────
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,!?;:]$/, '')
function Write({ deckId, cards, onExit }: { deckId: string; cards: Card[]; onExit: () => void }) {
  const order = useMemo(() => shuffle(cards).slice(0, Math.min(12, cards.length)), [cards])
  const [i, setI] = useState(0)
  const [val, setVal] = useState('')
  const [checked, setChecked] = useState<null | boolean>(null)
  const [correct, setCorrect] = useState(0)
  const [finished, setFinished] = useState(false)
  const start = useRef(Date.now())
  const c = order[i]

  function submit() {
    if (checked !== null || !val.trim()) return
    const ok = norm(val) === norm(c.definition)
    setChecked(ok)
    if (ok) setCorrect(x => x + 1)
  }
  function next() {
    if (i + 1 >= order.length) {
      const xp = correct * 15 + (correct === order.length ? 30 : 0)
      setFinished(true)
      recordAttempt(deckId, 'write', correct, order.length, xp, Date.now() - start.current)
    } else { setI(i + 1); setVal(''); setChecked(null) }
  }

  if (finished) return <ResultScreen title="Write" correct={correct} total={order.length} xp={correct * 15 + (correct === order.length ? 30 : 0)} onExit={onExit} />

  return (
    <ModeShell title="Write" onExit={onExit} progress={`${i + 1} / ${order.length}`}>
      <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 text-center mb-4">
        <p className="text-stone-600 text-[10px] uppercase tracking-widest mb-2">Type the answer</p>
        <p className="font-serif text-2xl text-amber-100">{c.term}</p>
      </div>
      <input
        autoFocus value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') (checked === null ? submit() : next()) }}
        disabled={checked !== null}
        placeholder="your answer…"
        className={`w-full rounded-xl px-4 py-3.5 text-lg border focus:outline-none transition-colors ${
          checked === null ? 'bg-stone-950 border-stone-800 text-amber-50 focus:border-indigo-500'
          : checked ? 'bg-emerald-900/40 border-emerald-700 text-emerald-100'
          : 'bg-red-900/40 border-red-800 text-red-100'}`}
      />
      {checked === false && (
        <p className="text-stone-400 text-sm mt-3">Answer: <span className="text-emerald-300">{c.definition}</span></p>
      )}
      <button
        onClick={() => (checked === null ? submit() : next())}
        disabled={checked === null && !val.trim()}
        className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl py-3 text-sm font-medium">
        {checked === null ? 'Check' : (i + 1 >= order.length ? 'See results' : 'Next')}
      </button>
    </ModeShell>
  )
}

// ────────────────────────── Learn (adaptive — repeats what you miss) ──────────────────────────
function Learn({ deckId, cards, onExit }: { deckId: string; cards: Card[]; onExit: () => void }) {
  const all = useMemo(() => shuffle(cards), [cards])
  const [queue, setQueue] = useState<string[]>(() => all.map(c => c.id))
  const missed = useRef<Set<string>>(new Set())
  const [picked, setPicked] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)
  const start = useRef(Date.now())
  const byId = useMemo(() => new Map(all.map(c => [c.id, c])), [all])

  const currentId = queue[0]
  const c = currentId ? byId.get(currentId)! : null
  const options = useMemo(() => {
    if (!c) return []
    const distractors = shuffle(all.filter(x => x.id !== c.id)).slice(0, 3).map(x => x.definition)
    return shuffle([c.definition, ...distractors])
  }, [currentId, all]) // eslint-disable-line react-hooks/exhaustive-deps

  function choose(opt: string) {
    if (picked !== null || !c) return
    setPicked(opt)
    if (opt !== c.definition) missed.current.add(c.id)
  }
  function advance() {
    if (!c) return
    const right = picked === c.definition
    setPicked(null)
    const rest = queue.slice(1)
    const nq = right ? rest : [...rest, c.id] // requeue a missed card to the back
    if (nq.length === 0) {
      const firstTry = all.length - missed.current.size
      const xp = all.length * 12 + firstTry * 3
      setFinished(true)
      recordAttempt(deckId, 'learn', firstTry, all.length, xp, Date.now() - start.current)
    } else { setQueue(nq) }
  }

  if (finished) {
    const firstTry = all.length - missed.current.size
    return <ResultScreen title="Learn" correct={firstTry} total={all.length} xp={all.length * 12 + firstTry * 3} label="first-try correct" onExit={onExit} />
  }
  if (!c) return null

  const remaining = new Set(queue).size
  const pct = Math.round(((all.length - remaining) / all.length) * 100)

  return (
    <ModeShell title="Learn" onExit={onExit} progress={`${all.length - remaining} / ${all.length} mastered`}>
      <div className="h-1.5 rounded-full bg-stone-800 overflow-hidden mb-4">
        <div className="h-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 text-center mb-4">
        <p className="text-stone-600 text-[10px] uppercase tracking-widest mb-2">What matches</p>
        <p className="font-serif text-2xl text-amber-100">{c.term}</p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {options.map(opt => {
          const isRight = opt === c.definition
          const state = picked === null ? '' : isRight ? 'right' : picked === opt ? 'wrong' : 'dim'
          return (
            <button key={opt} onClick={() => choose(opt)} disabled={picked !== null}
              className={`w-full text-left rounded-xl px-4 py-3.5 border transition-colors ${
                state === 'right' ? 'bg-emerald-900/40 border-emerald-700 text-emerald-100'
                : state === 'wrong' ? 'bg-red-900/40 border-red-800 text-red-100'
                : state === 'dim' ? 'bg-stone-950/60 border-stone-800 text-stone-500'
                : 'bg-stone-950 border-stone-800 text-amber-50 hover:border-indigo-500'}`}>
              {opt}
            </button>
          )
        })}
      </div>
      {picked !== null && (
        <button onClick={advance} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 text-sm font-medium">Continue</button>
      )}
    </ModeShell>
  )
}

// ────────────────────────── Match game ──────────────────────────
function Match({ deckId, cards, onExit }: { deckId: string; cards: Card[]; onExit: () => void }) {
  const pairs = useMemo(() => shuffle(cards).slice(0, Math.min(6, cards.length)), [cards])
  const tiles = useMemo(() => shuffle([
    ...pairs.map(c => ({ key: `t-${c.id}`, cardId: c.id, text: c.term })),
    ...pairs.map(c => ({ key: `d-${c.id}`, cardId: c.id, text: c.definition })),
  ]), [pairs])

  const [sel, setSel] = useState<string | null>(null)
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [wrong, setWrong] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [finished, setFinished] = useState(false)
  const start = useRef(Date.now())

  useEffect(() => {
    if (finished) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start.current) / 1000)), 250)
    return () => clearInterval(t)
  }, [finished])

  function tap(key: string, cardId: string) {
    if (matched.has(key) || finished || wrong) return
    if (sel === null) { setSel(key); return }
    if (sel === key) { setSel(null); return }
    const selCard = tiles.find(t => t.key === sel)!
    if (selCard.cardId === cardId) {
      const nm = new Set(matched); nm.add(sel); nm.add(key); setMatched(nm); setSel(null)
      if (nm.size === tiles.length) finish()
    } else {
      setWrong(key)
      setTimeout(() => { setWrong(null); setSel(null) }, 500)
    }
  }
  function finish() {
    const secs = Math.floor((Date.now() - start.current) / 1000)
    const xp = pairs.length * 8 + Math.max(0, 60 - secs)
    setFinished(true)
    recordAttempt(deckId, 'match', pairs.length, pairs.length, xp, Date.now() - start.current)
  }

  if (finished) {
    const secs = Math.floor((Date.now() - start.current) / 1000)
    const xp = pairs.length * 8 + Math.max(0, 60 - secs)
    return (
      <ModeShell title="Match" onExit={onExit}>
        <div className="text-center py-10">
          <p className="text-stone-500 text-xs uppercase tracking-widest">Matched in</p>
          <p className="font-serif text-6xl text-amber-100 my-2">{secs}s</p>
          <p className="text-amber-400 font-medium text-lg flex items-center justify-center gap-2"><Zap size={18} />+{xp} XP</p>
          <div className="flex gap-2 mt-8">
            <button onClick={onExit} className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl py-3 text-sm">Done</button>
            <button onClick={() => location.reload()} className="flex-1 bg-amber-700 hover:bg-amber-600 text-amber-50 rounded-xl py-3 text-sm">Again</button>
          </div>
        </div>
      </ModeShell>
    )
  }

  return (
    <ModeShell title="Match" onExit={onExit} progress={`${elapsed}s`}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {tiles.map(t => {
          const isMatched = matched.has(t.key)
          const isSel = sel === t.key
          const isWrong = wrong === t.key
          return (
            <button key={t.key} onClick={() => tap(t.key, t.cardId)} disabled={isMatched}
              className={`min-h-[5rem] rounded-xl px-3 py-3 text-sm text-center flex items-center justify-center border transition-all ${
                isMatched ? 'opacity-0 pointer-events-none'
                : isWrong ? 'bg-red-900/40 border-red-800 text-red-100'
                : isSel ? 'bg-amber-800/40 border-amber-600 text-amber-100'
                : 'bg-stone-900 border-stone-800 text-amber-50 hover:border-amber-700'}`}>
              {t.text}
            </button>
          )
        })}
      </div>
    </ModeShell>
  )
}

// ────────────────────────── Review (spaced repetition) ──────────────────────────
function Review({ deckId, cards, onExit }: { deckId: string; cards: Card[]; onExit: () => void }) {
  // Parent only passed all cards; we review the whole deck here (server tracks due).
  const queue = useMemo(() => shuffle(cards), [cards])
  const [i, setI] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [finished, setFinished] = useState(false)
  const c = queue[i]

  async function rate(got: boolean) {
    await reviewCard(c.id, got)
    const nc = correct + (got ? 1 : 0)
    if (i + 1 >= queue.length) {
      setCorrect(nc); setFinished(true)
      recordAttempt(deckId, 'review', nc, queue.length, nc * 5)
    } else {
      setCorrect(nc); setI(i + 1); setRevealed(false)
    }
  }

  if (finished) {
    return (
      <ModeShell title="Review" onExit={onExit}>
        <div className="text-center py-10">
          <p className="text-stone-500 text-xs uppercase tracking-widest">Reviewed</p>
          <p className="font-serif text-5xl text-amber-100 my-2">{correct}<span className="text-stone-600 text-2xl">/{queue.length}</span></p>
          <p className="text-amber-400 font-medium flex items-center justify-center gap-2"><Zap size={16} />+{correct * 5} XP</p>
          <p className="text-stone-500 text-sm mt-3">Cards you missed come back sooner.</p>
          <button onClick={onExit} className="w-full mt-8 bg-amber-700 hover:bg-amber-600 text-amber-50 rounded-xl py-3 text-sm">Done</button>
        </div>
      </ModeShell>
    )
  }

  return (
    <ModeShell title="Review" onExit={onExit} progress={`${i + 1} / ${queue.length}`}>
      <div className="w-full min-h-[16rem] rounded-3xl bg-stone-900 border border-stone-800 flex items-center justify-center p-8 text-center card-glow">
        <div>
          <p className="text-stone-600 text-[10px] uppercase tracking-widest mb-3">term</p>
          <p className="font-serif text-2xl text-amber-100">{c.term}</p>
          {revealed && <><div className="h-px bg-stone-800 my-5" /><p className="text-amber-200">{c.definition}</p></>}
        </div>
      </div>
      {!revealed ? (
        <button onClick={() => setRevealed(true)} className="w-full mt-4 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl py-3 text-sm">Show answer</button>
      ) : (
        <div className="flex gap-2 mt-4">
          <button onClick={() => rate(false)} className="flex-1 bg-red-900/40 hover:bg-red-900/60 border border-red-800/60 text-red-100 rounded-xl py-3 text-sm flex items-center justify-center gap-2"><X size={16} /> Missed</button>
          <button onClick={() => rate(true)} className="flex-1 bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-100 rounded-xl py-3 text-sm flex items-center justify-center gap-2"><Check size={16} /> Got it</button>
        </div>
      )}
    </ModeShell>
  )
}

// ────────────────────────── Shared celebratory result ──────────────────────────
function ResultScreen({ title, correct, total, xp, label, onExit }: {
  title: string; correct: number; total: number; xp: number; label?: string; onExit: () => void
}) {
  const perfect = correct === total && total > 0
  return (
    <ModeShell title={title} onExit={onExit}>
      <div className="text-center py-8">
        <div className="text-5xl mb-2">{perfect ? '🎉' : correct / Math.max(1, total) >= 0.6 ? '💪' : '🌱'}</div>
        <p className="text-stone-500 text-xs uppercase tracking-widest">{label ?? 'You scored'}</p>
        <p className="font-serif text-6xl text-amber-100 my-2">{correct}<span className="text-stone-600 text-3xl">/{total}</span></p>
        <p className="inline-flex items-center gap-2 text-lg font-semibold text-indigo-300 bg-indigo-950/50 border border-indigo-800/50 rounded-full px-4 py-1.5">
          <Zap size={18} className="text-indigo-400" />+{xp} XP
        </p>
        {perfect && <p className="text-emerald-300 text-sm mt-3">Perfect run! 🔥</p>}
        <div className="flex gap-2 mt-8">
          <button onClick={onExit} className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl py-3 text-sm">Done</button>
          <button onClick={() => location.reload()} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 text-sm font-medium">Again</button>
        </div>
      </div>
    </ModeShell>
  )
}

// ────────────────────────── Shared shell ──────────────────────────
function ModeShell({ title, onExit, progress, children }: { title: string; onExit: () => void; progress?: string; children: React.ReactNode }) {
  return (
    <div className="px-4 pt-4 pb-8 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onExit} className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-300 text-sm transition-colors">
          <ArrowLeft size={15} /> {title}
        </button>
        {progress && <span className="text-stone-500 text-sm">{progress}</span>}
      </div>
      {children}
    </div>
  )
}
