'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

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
      const { data: joined, error: joinError } = await supabase
        .rpc('accept_invite', { token: inviteToken.trim(), new_user_id: data.user.id })
      if (joinError || !joined) return { error: 'That invite link is invalid or has already been used.' }
      redirect(safeNext ?? '/')
    } else {
      // An unchecked failure here left the account with no couple row, and the
      // (app) layout and /invite-partner then redirected to each other forever.
      const { error: coupleError } = await supabase
        .from('couple')
        .insert({ user1_id: data.user.id })
      if (coupleError) return { error: "We couldn't create your space. Please try again." }
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

// Emails a reset link. Always reports success, so the form can't be used to
// find out which emails have accounts.
export async function requestPasswordReset(_: unknown, formData: FormData): Promise<{ sent?: boolean; error?: string }> {
  const email = String(formData.get('email') ?? '').trim()
  if (!email) return { error: 'Enter your email.' }
  const h = await headers()
  const origin = h.get('origin') ?? `https://${h.get('host')}`
  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/api/auth/callback?next=/reset-password`,
  })
  return { sent: true }
}

export async function updatePassword(_: unknown, formData: FormData): Promise<{ error?: string }> {
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')
  if (password.length < 8) return { error: 'Use at least 8 characters.' }
  if (password !== confirm) return { error: 'Those passwords don’t match.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'This reset link has expired. Request a new one.' }
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }
  redirect('/')
}
