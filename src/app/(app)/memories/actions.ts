'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createMemory(data: {
  title: string
  body: string
  happenedAt: string
  tags: string[]
  photoPaths: string[]
  latitude?: number | null
  longitude?: number | null
  locationName?: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memory, error } = await supabase
    .from('memories')
    .insert({
      title: data.title,
      body: data.body,
      happened_at: data.happenedAt,
      tags: data.tags,
      created_by: user.id,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      location_name: data.locationName ?? null,
    })
    .select()
    .single()

  if (error || !memory) return { error: error?.message ?? 'Failed to create memory' }

  if (data.photoPaths.length > 0) {
    await supabase.from('photos').insert(
      data.photoPaths.map(path => ({
        memory_id: memory.id,
        storage_path: path,
        uploaded_by: user.id,
      }))
    )
  }

  revalidatePath('/')
  return { memoryId: memory.id }
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
