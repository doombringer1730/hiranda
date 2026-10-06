'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Removes every storage file under a user's folder (uploads are stored as
// `<user id>/...`), walking a few levels of subfolders.
async function removeFolder(admin: ReturnType<typeof createAdminClient>, bucket: string, prefix: string, depth = 0) {
  if (depth > 3) return
  const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000 })
  if (!data?.length) return
  const files = data.filter(e => e.id).map(e => `${prefix}/${e.name}`)
  if (files.length) await admin.storage.from(bucket).remove(files)
  for (const dir of data.filter(e => !e.id)) await removeFolder(admin, bucket, `${prefix}/${dir.name}`, depth + 1)
}

export async function deleteAccount(_: unknown, formData: FormData): Promise<{ error?: string }> {
  if (String(formData.get('confirm') ?? '').trim().toUpperCase() !== 'DELETE') return { error: 'Type DELETE to confirm.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') redirect('/verify-2fa?next=/settings')
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: 'Account deletion isn’t configured on this server.' }

  const admin = createAdminClient()
  // 1. Data, in one transaction (see migrations/020_account_deletion.sql).
  const { error: purgeError } = await admin.rpc('purge_user_data', { target: user.id })
  if (purgeError) return { error: 'Couldn’t delete your data. Nothing was removed — please try again.' }

  // 2. Files (best effort — the rows pointing at them are already gone).
  for (const bucket of ['photos', 'epubs', 'videos']) await removeFolder(admin, bucket, user.id).catch(() => {})
  await admin.storage.from('avatars').remove([user.id]).catch(() => {})
  await admin.storage.from('banners').remove([user.id]).catch(() => {})

  // 3. The login itself (cascades profile, couple, games, study, push).
  const { error: authError } = await admin.auth.admin.deleteUser(user.id)
  if (authError) return { error: 'Your data was removed, but the login couldn’t be deleted. Please try again.' }

  await supabase.auth.signOut()
  redirect('/login?error=' + encodeURIComponent('Your account has been deleted.'))
}
