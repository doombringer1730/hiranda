import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

async function saveName(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = (formData.get('name') as string).trim()
  if (!name) return

  await supabase.from('profiles').upsert({ id: user.id, display_name: name })
  redirect('/')
}

export default async function SetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  if (profile?.display_name) redirect('/')

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-stone-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_80%,rgba(120,53,15,0.15),transparent_70%)] pointer-events-none" />
      <div className="w-full max-w-sm relative z-10">
        <h1 className="font-serif text-4xl text-amber-100 text-center mb-2">Hiranda</h1>
        <p className="text-stone-400 text-center text-sm mb-10">What should we call you?</p>
        <form action={saveName} className="flex flex-col gap-4">
          <input
            name="name"
            type="text"
            required
            autoFocus
            className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors"
            placeholder="Your name"
          />
          <button
            type="submit"
            className="bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium rounded-xl px-4 py-3 transition-colors"
          >
            Continue
          </button>
        </form>
      </div>
    </main>
  )
}
