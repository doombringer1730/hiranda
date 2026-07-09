import 'server-only'
import { createHash } from 'crypto'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// The Theater (watch/sync + streaming sources) is hidden behind a shared
// passcode. Unlock is a session cookie whose value must equal the stored hash,
// so it can't be faked without knowing the passcode. This is UI-gating — the
// underlying data is already couple-scoped by RLS.

const PEPPER = 'hiranda-theater-v1'
export const THEATER_COOKIE = 'theater'

export function hashPasscode(pass: string): string {
  return createHash('sha256').update(PEPPER + pass.trim()).digest('hex')
}

export async function getTheaterState(): Promise<{ hasPasscode: boolean; unlocked: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { hasPasscode: false, unlocked: false }

  const { data: couple } = await supabase
    .from('couple')
    .select('theater_passcode_hash')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .maybeSingle()

  const hash = couple?.theater_passcode_hash ?? null
  if (!hash) return { hasPasscode: false, unlocked: false }

  const cookieVal = (await cookies()).get(THEATER_COOKIE)?.value
  return { hasPasscode: true, unlocked: cookieVal === hash }
}
