// Shown only to testers while Stripe runs on test keys.
export default function TestCardHint() {
  return (
    <p className="rounded-2xl border border-dashed border-amber-800/60 px-4 py-3 text-xs text-amber-300/90 leading-relaxed">
      Test mode — only you can see this. Pay with card <span className="font-mono">4242 4242 4242 4242</span>, any future date, any CVC. No real money moves.
    </p>
  )
}
