'use client'

// Leaves the page instantly and replaces it in history, so the back button
// doesn't return here — standard on domestic-violence support pages.
export default function QuickExit() {
  return (
    <button
      onClick={() => window.location.replace('https://weather.com')}
      className="fixed top-3 right-3 z-50 rounded-full bg-red-700 hover:bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg"
      style={{ minHeight: 0 }}
    >
      Leave quickly ✕
    </button>
  )
}
