'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function addDate(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('important_dates').insert({
    label: formData.get('label') as string,
    date: formData.get('date') as string,
    recurring: formData.get('recurring') === 'on',
    note: (formData.get('note') as string) || null,
    created_by: user.id,
  })

  revalidatePath('/dates')
  redirect('/dates')
}

export async function deleteDate(id: string) {
  const supabase = await createClient()
  await supabase.from('important_dates').delete().eq('id', id)
  revalidatePath('/dates')
}
