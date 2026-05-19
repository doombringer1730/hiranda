'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type PromptType = 'question' | 'would_you_rather' | 'this_or_that'

export async function getCoupleMemberIds() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: couple } = await supabase
    .from('couple')
    .select('user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .maybeSingle()

  const partnerId = couple
    ? couple.user1_id === user.id ? couple.user2_id : couple.user1_id
    : null

  return { userId: user.id, partnerId }
}

export async function getActivePrompt(type: PromptType) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: couple } = await supabase
    .from('couple')
    .select('user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .maybeSingle()

  const partnerId = couple
    ? couple.user1_id === user.id ? couple.user2_id : couple.user1_id
    : null

  // Find a prompt where one or both members have responded (most recent activity first)
  const { data: activeResponse } = await supabase
    .from('prompt_responses')
    .select('prompt_id, prompts!inner(id, type, text, option_a, option_b)')
    .eq('prompts.type', type)
    .in('user_id', [user.id, ...(partnerId ? [partnerId] : [])])
    .order('responded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let promptId: string | null = null

  if (activeResponse) {
    // Check if both have answered this prompt
    const { data: responses } = await supabase
      .from('prompt_responses')
      .select('user_id, response')
      .eq('prompt_id', activeResponse.prompt_id)

    const myRes = responses?.find(r => r.user_id === user.id)
    const partnerRes = responses?.find(r => r.user_id === partnerId)

    // If both answered, this one is done — find a new unanswered one
    if (myRes && partnerRes) {
      promptId = null
    } else {
      promptId = activeResponse.prompt_id
    }
  }

  if (!promptId) {
    // Pick a random prompt of this type that neither has answered
    const { data: answered } = await supabase
      .from('prompt_responses')
      .select('prompt_id')
      .in('user_id', [user.id, ...(partnerId ? [partnerId] : [])])

    const answeredIds = [...new Set(answered?.map(r => r.prompt_id) ?? [])]

    const query = supabase
      .from('prompts')
      .select('id, text, option_a, option_b')
      .eq('type', type)

    if (answeredIds.length > 0) query.not('id', 'in', `(${answeredIds.join(',')})`)

    const { data: unanswered } = await query
    if (unanswered && unanswered.length > 0) {
      const pick = unanswered[Math.floor(Math.random() * unanswered.length)]
      promptId = pick.id
    } else {
      // All answered — pick any random one
      const { data: any } = await supabase
        .from('prompts')
        .select('id')
        .eq('type', type)
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

  await supabase
    .from('prompt_responses')
    .upsert({ prompt_id: promptId, user_id: user.id, response })
}

export async function getNextPrompt(type: PromptType, excludePromptId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: couple } = await supabase
    .from('couple')
    .select('user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .maybeSingle()

  const partnerId = couple
    ? couple.user1_id === user.id ? couple.user2_id : couple.user1_id
    : null

  const { data: answered } = await supabase
    .from('prompt_responses')
    .select('prompt_id')
    .in('user_id', [user.id, ...(partnerId ? [partnerId] : [])])

  const answeredIds = [...new Set(answered?.map(r => r.prompt_id) ?? []), excludePromptId]

  const { data: unanswered } = await supabase
    .from('prompts')
    .select('id, type, text, option_a, option_b')
    .eq('type', type)
    .not('id', 'in', `(${answeredIds.join(',')})`)

  let prompt = unanswered && unanswered.length > 0
    ? unanswered[Math.floor(Math.random() * unanswered.length)]
    : null

  if (!prompt) {
    const { data: any } = await supabase
      .from('prompts')
      .select('id, type, text, option_a, option_b')
      .eq('type', type)
      .neq('id', excludePromptId)
    if (any && any.length > 0) prompt = any[Math.floor(Math.random() * any.length)]
  }

  return prompt ? { prompt, myResponse: null, partnerResponse: null } : null
}
