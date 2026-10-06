// The standard page title: a small spaced-caps tagline over a big serif
// title with an accent full stop — the same treatment as Home and the logo.
export default function PageHeader({ eyebrow, title, className = '' }: {
  eyebrow: string
  title: string
  className?: string
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-stone-500 text-[10px] uppercase tracking-[0.3em] truncate">{eyebrow}</p>
      <h1 className="font-serif text-4xl text-amber-50 mt-2 leading-none">
        {title}<span className="text-amber-500">.</span>
      </h1>
    </div>
  )
}
