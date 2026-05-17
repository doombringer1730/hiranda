'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createMemory(_: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const title = formData.get('title') as string
  const body = formData.get('body') as string
  const happenedAt = formData.get('happened_at') as string
  const tagsRaw = formData.get('tags') as string
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : []

  const { data: memory, error } = await supabase
    .from('memories')
    .insert({ title, body, happened_at: happenedAt, tags, created_by: user.id })
    .select()
    .single()

  if (error || !memory) return { error: error?.message ?? 'Failed to create memory' }

  // Handle photo uploads
  const photos = formData.getAll('photos') as File[]
  for (const photo of photos) {
    if (!photo.size) continue
    const ext = photo.name.split('.').pop()
    const path = `${user.id}/${memory.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('photos').upload(path, photo)
    if (!uploadError) {
      await supabase.from('photos').insert({
        memory_id: memory.id,
        storage_path: path,
        uploaded_by: user.id,
      })
    }
  }

  revalidatePath('/')
  redirect(`/memories/${memory.id}`)
}

export async function deleteMemory(id: string) {
  const supabase = await createClient()
  await supabase.from('memories').delete().eq('id', id)
  revalidatePath('/')
  redirect('/')
}

export async function deletePhoto(photoId: string, storagePath: string, memoryId: string) {
  const supabase = await createClient()
  await supabase.storage.from('photos').remove([storagePath])
  await supabase.from('photos').delete().eq('id', photoId)
  revalidatePath(`/memories/${memoryId}`)
}
