// A quiet footnote with the research behind a feature — one finding, one
// source, no lecture. Kept to real, citable studies.
export default function WhyItWorks({ children, source, className = '' }: { children: React.ReactNode; source: string; className?: string }) {
  return (
    <p className={`text-stone-500 text-xs leading-relaxed ${className}`}>
      <span className="font-hand text-[17px] text-amber-300/90 mr-1">why it works:</span>
      {children} <span className="text-stone-600 whitespace-nowrap">— {source}</span>
    </p>
  )
}
