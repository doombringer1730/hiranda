'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function addTodo(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const text = formData.get('text') as string
  if (!text?.trim()) return

  await supabase.from('todos').insert({ text: text.trim(), created_by: user.id })
  revalidatePath('/todos')
}

export async function toggleTodo(id: string, completed: boolean) {
  const supabase = await createClient()
  await supabase.from('todos').update({ completed }).eq('id', id)
  revalidatePath('/todos')
}

export async function deleteTodo(id: string) {
  const supabase = await createClient()
  await supabase.from('todos').delete().eq('id', id)
  revalidatePath('/todos')
}
