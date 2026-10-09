import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// Does the signed-in user's couple have Plus? One check per request.
export const hasPlus = cache(async (): Promise<boolean> => {
  try {
    const supabase = await createClient()
    const { data } = await supabase.rpc('couple_has_plus')
    return data === true
  } catch {
    return false
  }
})

export type PlusDetails = {
  active: boolean; source: 'apple' | 'stripe' | 'grant' | null; status: string | null; renews: string | null
  trialEnds: string | null // the free week (no card), while it's the only Plus the couple has
}

// For the Plus page: where it came from and when it renews.
export async function plusDetails(): Promise<PlusDetails> {
  const supabase = await createClient()
  const [active, { data }, { data: trial }] = await Promise.all([
    hasPlus(),
    supabase.from('couple_plus').select('source, status, current_period_end').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('plus_trials').select('ends_at').maybeSingle(),
  ])
  const paid = !!data && ['active', 'trialing', 'past_due'].includes(data.status)
    && (!data.current_period_end || new Date(data.current_period_end) > new Date())
  const trialEnds = !paid && trial && new Date(trial.ends_at) > new Date() ? trial.ends_at as string : null
  return {
    active,
    source: paid ? data!.source : null,
    status: paid ? data!.status : null,
    renews: paid ? data!.current_period_end : null,
    trialEnds,
  }
}

export type TrialState = { offer: boolean; endsAt: string | null }

// The free week: can this couple start one, and is one running?
export async function trialState(): Promise<TrialState> {
  const supabase = await createClient()
  const [plus, { data: trial }] = await Promise.all([
    hasPlus(),
    supabase.from('plus_trials').select('ends_at').maybeSingle(),
  ])
  const running = !!trial && new Date(trial.ends_at) > new Date()
  return { offer: !plus && !trial, endsAt: running ? trial!.ends_at : null }
}
