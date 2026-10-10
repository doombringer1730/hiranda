import LoginForm from './login-form'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams
  return (
    <main className="login">
      <LoginForm next={typeof next === 'string' ? next : ''} />
    </main>
  )
}
