'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createEntry(data: {
  title: string
  body: string
  mood: string | null
  tags: string[]
  photoPaths: string[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: entry, error } = await supabase
    .from('journal_entries')
    .insert({
      title: data.title || null,
      body: data.body,
      mood: data.mood,
      tags: data.tags,
      created_by: user.id,
    })
    .select()
    .single()

  if (error || !entry) return { error: error?.message ?? 'Failed to create entry' }

  if (data.photoPaths.length > 0) {
    await supabase.from('journal_photos').insert(
      data.photoPaths.map(path => ({
        journal_entry_id: entry.id,
        storage_path: path,
        uploaded_by: user.id,
      }))
    )
  }

  revalidatePath('/journal')
  return { entryId: entry.id }
}

export async function deleteEntry(id: string) {
  const supabase = await createClient()
  await supabase.from('journal_entries').delete().eq('id', id)
  revalidatePath('/journal')
  redirect('/journal')
}

export async function deleteJournalPhoto(photoId: string, storagePath: string, entryId: string) {
  const supabase = await createClient()
  await supabase.storage.from('photos').remove([storagePath])
  await supabase.from('journal_photos').delete().eq('id', photoId)
  revalidatePath(`/journal/${entryId}`)
}
