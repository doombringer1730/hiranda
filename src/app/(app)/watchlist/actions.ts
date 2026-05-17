'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function addToWatchlist(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('watchlist').insert({
    title: (formData.get('title') as string).trim(),
    type: formData.get('type') as string,
    note: (formData.get('note') as string).trim() || null,
    added_by: user.id,
  })

  revalidatePath('/watchlist')
}

export async function markWatched(id: string) {
  const supabase = await createClient()
  await supabase
    .from('watchlist')
    .update({ watched: true, watched_at: new Date().toISOString() })
    .eq('id', id)
  revalidatePath('/watchlist')
}

export async function removeFromWatchlist(id: string) {
  const supabase = await createClient()
  await supabase.from('watchlist').delete().eq('id', id)
  revalidatePath('/watchlist')
}
