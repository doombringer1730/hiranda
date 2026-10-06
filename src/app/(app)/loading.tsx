// Shown instantly while a page's data loads, so taps always get feedback.
export default function Loading() {
  return (
    <div className="px-4 pt-8 max-w-2xl mx-auto flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-3 w-28 rounded-full" />
      <div className="skeleton h-10 w-48" />
      <div className="skeleton h-28 mt-4" />
      <div className="skeleton h-20" />
      <div className="skeleton h-20" />
    </div>
  )
}
