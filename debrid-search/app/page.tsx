import Browser from './browser'
import { logout } from './login/actions'

export default function Home() {
  return (
    <main className="page">
      <header className="top">
        <h1>Search</h1>
        <form action={logout}><button type="submit" className="link">Sign out</button></form>
      </header>
      <Browser />
    </main>
  )
}
