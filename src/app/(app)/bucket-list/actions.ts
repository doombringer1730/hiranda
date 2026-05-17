'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function addBucketItem(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('bucket_list').insert({
    title: formData.get('title') as string,
    category: formData.get('category') as string,
    created_by: user.id,
  })
  revalidatePath('/bucket-list')
}

export async function completeBucketItem(id: string) {
  const supabase = await createClient()
  await supabase.from('bucket_list').update({
    completed: true,
    completed_at: new Date().toISOString(),
  }).eq('id', id)
  revalidatePath('/bucket-list')
}

export async function deleteBucketItem(id: string) {
  const supabase = await createClient()
  await supabase.from('bucket_list').delete().eq('id', id)
  revalidatePath('/bucket-list')
}
