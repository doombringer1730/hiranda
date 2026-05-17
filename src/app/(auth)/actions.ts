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
  redirect('/')
}

export async function signup(_: unknown, formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const displayName = formData.get('display_name') as string
  const inviteToken = formData.get('invite_token') as string | null

  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { error: error.message }

  if (data.user) {
    await supabase.from('profiles').insert({
      id: data.user.id,
      display_name: displayName,
    })

    if (inviteToken?.trim()) {
      // Link to the existing couple via invite token
      const { error: joinError } = await supabase
        .from('couple')
        .update({ user2_id: data.user.id })
        .eq('invite_token', inviteToken.trim())
        .is('user2_id', null)
      if (joinError) return { error: 'Invalid or already used invite link.' }
    } else {
      // First person — create the couple space
      await supabase.from('couple').insert({ user1_id: data.user.id })
    }
  }

  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
