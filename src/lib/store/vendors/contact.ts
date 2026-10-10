import 'server-only'

/** The shop's own email — suppliers that insist on an email on the shipping
 *  address get this, never a user's. STORE_CONTACT_EMAIL, or the first admin. */
export function storeContactEmail() {
  return process.env.STORE_CONTACT_EMAIL?.trim()
    || (process.env.STORE_ADMIN_EMAILS ?? '').split(',').map(s => s.trim()).find(Boolean)
    || null
}

/** Our public origin, for URLs suppliers fetch (print files). */
export const siteUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? 'https://hiranda.com').replace(/\/$/, '')

/** fetch → JSON with a timeout; throws on network errors and non-JSON bodies. */
export async function fetchJson(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const res = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(init.timeoutMs ?? 15000) })
  const text = await res.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { /* not JSON */ }
  return { ok: res.ok, status: res.status, body: body as Record<string, unknown> | null, text }
}
