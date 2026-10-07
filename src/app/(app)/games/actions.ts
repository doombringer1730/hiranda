'use server'

import { hasPlus } from '@/lib/plus'
import { PLUS_DEPTH } from '@/lib/plus-config'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notifyPartner, myFirstName } from '@/lib/push'

type PromptType = 'question' | 'would_you_rather' | 'this_or_that' | 'most_likely'

export async function getCoupleMemberIds() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: couple } = await supabase
    .from('couple')
    .select('user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    // Prefer the paired space: someone who started their own space and then
    // joined their partner's has two rows, and .maybeSingle() alone fails.
    .order('user2_id', { nullsFirst: false }).limit(1)
    .maybeSingle()

  const partnerId = couple
    ? couple.user1_id === user.id ? couple.user2_id : couple.user1_id
    : null

  return { userId: user.id, partnerId }
}

// Questions come in decks (1 Light, 2 Deeper, 3 Deepest). A deck only opens
// once you've both opted in, so the requested deck is capped at couple_depth().
async function allowedDeck(supabase: Awaited<ReturnType<typeof createClient>>, type: PromptType, deck?: number) {
  if (type !== 'question' || !deck) return null
  const { data } = await supabase.rpc('couple_depth')
  return Math.max(1, Math.min(deck, (data as number | null) ?? 1))
}

export async function getActivePrompt(type: PromptType, deck?: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: couple } = await supabase
    .from('couple')
    .select('user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    // Prefer the paired space: someone who started their own space and then
    // joined their partner's has two rows, and .maybeSingle() alone fails.
    .order('user2_id', { nullsFirst: false }).limit(1)
    .maybeSingle()

  const partnerId = couple
    ? couple.user1_id === user.id ? couple.user2_id : couple.user1_id
    : null

  const depth = await allowedDeck(supabase, type, deck)

  // Find a prompt where one or both members have responded (most recent activity first)
  let active = supabase
    .from('prompt_responses')
    .select('prompt_id, prompts!inner(id, type, text, option_a, option_b, depth)')
    .eq('prompts.type', type)
    .in('user_id', [user.id, ...(partnerId ? [partnerId] : [])])
  if (depth) active = active.eq('prompts.depth', depth)
  const { data: activeResponse } = await active
    .order('responded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Resume the most recently active prompt, whether one or both members have
  // answered. If both have answered it stays here so the reveal is shown —
  // the user leaves it explicitly via "Next prompt" (getNextPrompt). Skipping
  // fully-answered prompts here made the reveal unreachable.
  let promptId: string | null = activeResponse?.prompt_id ?? null

  if (!promptId) {
    // Pick a random prompt of this type that neither has answered
    const { data: answered } = await supabase
      .from('prompt_responses')
      .select('prompt_id')
      .in('user_id', [user.id, ...(partnerId ? [partnerId] : [])])

    const answeredIds = [...new Set(answered?.map(r => r.prompt_id) ?? [])]

    let query = supabase
      .from('prompts')
      .select('id, text, option_a, option_b')
      .eq('type', type)
    if (depth) query = query.eq('depth', depth)

    if (answeredIds.length > 0) query = query.not('id', 'in', `(${answeredIds.join(',')})`)

    const { data: unanswered } = await query
    if (unanswered && unanswered.length > 0) {
      const pick = unanswered[Math.floor(Math.random() * unanswered.length)]
      promptId = pick.id
    } else {
      // All answered — pick any random one
      let anyQ = supabase
        .from('prompts')
        .select('id')
        .eq('type', type)
      if (depth) anyQ = anyQ.eq('depth', depth)
      const { data: any } = await anyQ
      if (any && any.length > 0) promptId = any[Math.floor(Math.random() * any.length)].id
    }
  }

  if (!promptId) return null

  const { data: prompt } = await supabase
    .from('prompts')
    .select('id, type, text, option_a, option_b')
    .eq('id', promptId)
    .single()

  if (!prompt) return null

  const { data: responses } = await supabase
    .from('prompt_responses')
    .select('user_id, response')
    .eq('prompt_id', promptId)

  const myResponse = responses?.find(r => r.user_id === user.id)?.response ?? null
  const partnerResponse = responses?.find(r => r.user_id === partnerId)?.response ?? null

  return { prompt, myResponse, partnerResponse, userId: user.id, partnerId }
}

export async function submitResponse(promptId: string, response: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: before } = await supabase
    .from('prompt_responses').select('user_id').eq('prompt_id', promptId)
  const firstAnswer = !(before ?? []).some(r => r.user_id === user.id)
  const partnerAnswered = (before ?? []).some(r => r.user_id !== user.id)

  // Uniqueness is on (prompt_id, user_id), not the default primary key, so an
  // answer change would otherwise hit a unique-constraint violation.
  await supabase
    .from('prompt_responses')
    .upsert({ prompt_id: promptId, user_id: user.id, response }, { onConflict: 'prompt_id,user_id' })

  if (firstAnswer) {
    notifyPartner(async () => {
      const me = await myFirstName()
      return partnerAnswered
        ? { title: 'Answers revealed 👀', body: `${me} answered too — see what you both said.`, url: `/games/questions?p=${promptId}`, tag: `prompt-${promptId}` }
        : { title: `${me} answered a question`, body: 'Your turn — answers unlock when you both reply.', url: `/games/questions?p=${promptId}`, tag: `prompt-${promptId}` }
    })
  }
}

// Re-read a single prompt's state (my answer + partner's). Used by the client
// to poll while waiting for the partner to answer, so the reveal appears
// without a manual page reload.
export async function getPromptState(promptId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: couple } = await supabase
    .from('couple')
    .select('user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    // Prefer the paired space: someone who started their own space and then
    // joined their partner's has two rows, and .maybeSingle() alone fails.
    .order('user2_id', { nullsFirst: false }).limit(1)
    .maybeSingle()

  const partnerId = couple
    ? couple.user1_id === user.id ? couple.user2_id : couple.user1_id
    : null

  const { data: prompt } = await supabase
    .from('prompts')
    .select('id, type, text, option_a, option_b')
    .eq('id', promptId)
    .single()

  if (!prompt) return null

  const { data: responses } = await supabase
    .from('prompt_responses')
    .select('user_id, response')
    .eq('prompt_id', promptId)

  const myResponse = responses?.find(r => r.user_id === user.id)?.response ?? null
  const partnerResponse = responses?.find(r => r.user_id === partnerId)?.response ?? null

  return { prompt, myResponse, partnerResponse }
}

export async function getNextPrompt(type: PromptType, excludePromptId: string, deck?: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: couple } = await supabase
    .from('couple')
    .select('user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    // Prefer the paired space: someone who started their own space and then
    // joined their partner's has two rows, and .maybeSingle() alone fails.
    .order('user2_id', { nullsFirst: false }).limit(1)
    .maybeSingle()

  const partnerId = couple
    ? couple.user1_id === user.id ? couple.user2_id : couple.user1_id
    : null

  const { data: answered } = await supabase
    .from('prompt_responses')
    .select('prompt_id')
    .in('user_id', [user.id, ...(partnerId ? [partnerId] : [])])

  const answeredIds = [...new Set(answered?.map(r => r.prompt_id) ?? []), excludePromptId]
  const depth = await allowedDeck(supabase, type, deck)

  let freshQ = supabase
    .from('prompts')
    .select('id, type, text, option_a, option_b')
    .eq('type', type)
    .not('id', 'in', `(${answeredIds.join(',')})`)
  if (depth) freshQ = freshQ.eq('depth', depth)
  const { data: unanswered } = await freshQ

  let prompt = unanswered && unanswered.length > 0
    ? unanswered[Math.floor(Math.random() * unanswered.length)]
    : null

  if (!prompt) {
    let anyQ = supabase
      .from('prompts')
      .select('id, type, text, option_a, option_b')
      .eq('type', type)
      .neq('id', excludePromptId)
    if (depth) anyQ = anyQ.eq('depth', depth)
    const { data: any } = await anyQ
    if (any && any.length > 0) prompt = any[Math.floor(Math.random() * any.length)]
  }

  return prompt ? { prompt, myResponse: null, partnerResponse: null } : null
}

// ── Depth decks ──
export async function getDepthState() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const [{ data: rows }, { data: both }] = await Promise.all([
    supabase.from('depth_optins').select('user_id, max_depth'),
    supabase.rpc('couple_depth'),
  ])
  const mine = rows?.find(r => r.user_id === user.id)?.max_depth ?? 1
  const theirs = rows?.find(r => r.user_id !== user.id)?.max_depth ?? 1
  return { mine, theirs, both: (both as number | null) ?? 1 }
}

export async function setDepthOptin(level: number) {
  if (![1, 2, 3].includes(level)) return { error: 'Pick a deck' }
  if (level >= PLUS_DEPTH && !(await hasPlus())) return { error: 'The Deepest deck comes with Hiranda Plus.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { data: couple } = await supabase.from('couple').select('id, user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('user2_id', { nullsFirst: false }).limit(1).maybeSingle()
  if (!couple?.user2_id) return { error: 'Not paired' }
  const { data: before } = await supabase.rpc('couple_depth')
  await supabase.from('depth_optins').upsert({ couple_id: couple.id, user_id: user.id, max_depth: level, updated_at: new Date().toISOString() })
  const { data: after } = await supabase.rpc('couple_depth')
  const names = ['', 'Light', 'Deeper', 'Deepest']
  if ((after as number) > (before as number)) {
    notifyPartner(async () => ({ title: `The ${names[after as number]} deck is open 🔓`, body: `You and ${await myFirstName()} both opted in.`, url: '/games/questions?t=question', tag: 'depth' }))
  } else if (level > (after as number)) {
    // Gentle, one-time: never pressure.
    notifyPartner(async () => ({ title: `${await myFirstName()} is ready for ${names[level]} questions`, body: 'It only opens if you want it to — no pressure.', url: '/games/questions?t=question', tag: 'depth' }))
  }
  return { ok: true, both: (after as number) ?? 1 }
}
