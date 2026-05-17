'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function uploadMovie(_: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const file = formData.get('video') as File
  const title = formData.get('title') as string
  if (!file?.size) return { error: 'No file selected' }

  const ext = file.name.split('.').pop()
  const path = `${user.id}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage.from('videos').upload(path, file)
  if (uploadError) return { error: uploadError.message }

  const { data: session, error } = await supabase
    .from('watch_sessions')
    .insert({ title, storage_path: path, created_by: user.id })
    .select()
    .single()

  if (error || !session) return { error: error?.message ?? 'Failed to create session' }

  revalidatePath('/watch')
  redirect(`/watch/${session.id}`)
}

export async function deleteWatchSession(id: string, storagePath: string) {
  const supabase = await createClient()
  await supabase.storage.from('videos').remove([storagePath])
  await supabase.from('watch_sessions').delete().eq('id', id)
  revalidatePath('/watch')
  redirect('/watch')
}
