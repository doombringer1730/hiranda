'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(_: unknown, formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) return { error: error.message }
  const next = formData.get('next') as string | null
  redirect(next?.startsWith('/') ? next : '/')
}

export async function signup(_: unknown, formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const displayName = formData.get('display_name') as string
  const inviteToken = formData.get('invite_token') as string | null
  const next = formData.get('next') as string | null
  const safeNext = next?.startsWith('/') ? next : null

  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { error: error.message }

  if (data.user) {
    await supabase.from('profiles').insert({
      id: data.user.id,
      display_name: displayName,
    })

    if (inviteToken?.trim()) {
      const { error: joinError } = await supabase
        .from('couple')
        .update({ user2_id: data.user.id })
        .eq('invite_token', inviteToken.trim())
        .is('user2_id', null)
      if (joinError) return { error: 'That invite link is invalid or has already been used.' }
      redirect(safeNext ?? '/')
    } else {
      await supabase.from('couple').insert({ user1_id: data.user.id })
      redirect('/invite-partner')
    }
  }

  redirect(safeNext ?? '/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
