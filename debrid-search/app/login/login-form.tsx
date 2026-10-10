'use client'

import { useActionState } from 'react'
import { login } from './actions'

export default function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(login, null)
  return (
    <form action={action} className="card stack">
      <h1>Search</h1>
      <input type="hidden" name="next" value={next} />
      <input type="password" name="password" placeholder="Password" autoFocus required autoComplete="current-password" />
      <button type="submit" className="primary" disabled={pending}>{pending ? 'Checking…' : 'Enter'}</button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
