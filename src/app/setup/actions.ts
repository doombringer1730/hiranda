'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function saveName(_: unknown, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = (formData.get('name') as string).trim()
  if (!name) return { error: 'Please enter your name.' }

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, display_name: name })

  if (error) return { error: error.message }
  redirect('/')
}
