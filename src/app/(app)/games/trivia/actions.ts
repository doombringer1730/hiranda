'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createTrivia(question: string, options: string[], correct: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const q = question.trim()
  const opts = options.map(o => o.trim())
  if (!q) return { error: 'Write a question' }
  if (opts.length < 2 || opts.length > 4 || opts.some(o => !o)) return { error: 'Fill in 2–4 answers' }
  if (!Number.isInteger(correct) || correct < 0 || correct >= opts.length) return { error: 'Pick the right answer' }

  // Shuffle so the real answer isn't always in the slot it was typed into.
  const order = opts.map((_, i) => i).sort(() => Math.random() - 0.5)
  const { error } = await supabase.from('trivia_questions').insert({
    author: user.id,
    question: q,
    options: order.map(i => opts[i]),
    correct: order.indexOf(correct),
  })
  if (error) return { error: 'Could not save that question' }
  revalidatePath('/games/trivia')
  return {}
}

// Guess once on a question your partner wrote.
export async function guessTrivia(id: string, guess: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: q } = await supabase.from('trivia_questions')
    .select('author, options, correct, guess').eq('id', id).maybeSingle()
  if (!q) return { error: 'Question not found' }
  if (q.author === user.id) return { error: 'That one’s about you!' }
  if (q.guess !== null) return { correct: q.guess === q.correct }
  if (!Number.isInteger(guess) || guess < 0 || guess >= q.options.length) return { error: 'Invalid answer' }

  await supabase.from('trivia_questions')
    .update({ guess, guessed_at: new Date().toISOString() })
    .eq('id', id).is('guess', null)
  revalidatePath('/games/trivia')
  return { correct: guess === q.correct }
}

export async function deleteTrivia(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  await supabase.from('trivia_questions').delete().eq('id', id).eq('author', user.id)
  revalidatePath('/games/trivia')
}
