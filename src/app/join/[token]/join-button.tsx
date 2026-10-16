'use client'

import { useFormStatus } from 'react-dom'

// The one tap that joins a signed-in person to the space (see actions.ts).
export default function JoinButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
      className="w-full bg-amber-700 hover:bg-amber-600 disabled:opacity-60 text-amber-50 font-medium rounded-full px-4 py-3.5 transition-colors">
      {pending ? 'Joining…' : label}
    </button>
  )
}
