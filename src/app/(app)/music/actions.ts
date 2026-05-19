'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function addMusicMoment(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const songName = (formData.get('song_name') as string).trim()
  const artist = (formData.get('artist') as string).trim()
  const spotifyUrl = (formData.get('spotify_url') as string).trim() || null
  const note = (formData.get('note') as string).trim() || null

  if (!songName || !artist) return

  await supabase.from('music_moments').insert({
    song_name: songName,
    artist,
    spotify_url: spotifyUrl,
    note,
    added_by: user.id,
  })

  revalidatePath('/music')
}

export async function deleteMusicMoment(id: string) {
  const supabase = await createClient()
  await supabase.from('music_moments').delete().eq('id', id)
  revalidatePath('/music')
}
