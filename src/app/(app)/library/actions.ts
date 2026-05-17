'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function addBook(data: {
  title: string
  author: string
  epubPath: string
  coverPath: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: book, error } = await supabase
    .from('books')
    .insert({
      title: data.title,
      author: data.author,
      epub_path: data.epubPath,
      cover_path: data.coverPath,
      uploaded_by: user.id,
    })
    .select()
    .single()

  if (error || !book) return { error: error?.message ?? 'Failed to add book' }

  revalidatePath('/library')
  return { bookId: book.id }
}

export async function deleteBook(id: string, epubPath: string, coverPath: string | null) {
  const supabase = await createClient()
  await supabase.storage.from('epubs').remove([epubPath])
  if (coverPath) await supabase.storage.from('epubs').remove([coverPath])
  await supabase.from('books').delete().eq('id', id)
  revalidatePath('/library')
  redirect('/library')
}

export async function saveProgress(bookId: string, cfi: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('reading_progress').upsert(
    { book_id: bookId, user_id: user.id, cfi, updated_at: new Date().toISOString() },
    { onConflict: 'book_id,user_id' }
  )
}
