import 'server-only'
import http2 from 'node:http2'
import { createPrivateKey, sign } from 'node:crypto'

// Apple Push Notification service — native push for the iPhone app.
// Off until these are set (Vercel → Settings → Environment Variables):
//   APNS_KEY      the .p8 key's contents (newlines may be written as \n)
//   APNS_KEY_ID   its 10-character Key ID
//   APNS_TEAM_ID  your Apple Developer Team ID
//   APNS_BUNDLE_ID  the app's bundle identifier (default com.hiranda.app)
// Builds run straight from Xcode use Apple's sandbox; TestFlight and the App
// Store use production. We try production and fall back to the sandbox, so
// both kinds of install get notified.

const KEY = process.env.APNS_KEY?.replace(/\\n/g, '\n')
const KEY_ID = process.env.APNS_KEY_ID
const TEAM_ID = process.env.APNS_TEAM_ID
const TOPIC = process.env.APNS_BUNDLE_ID || 'com.hiranda.app'

export function apnsConfigured() {
  return !!(KEY && KEY_ID && TEAM_ID)
}

export type ApnsMessage = { title: string; body: string; url: string; tag?: string; urgent?: boolean }

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url')

// Provider tokens last an hour; Apple asks that they're reused, not minted per push.
let cached: { jwt: string; at: number } | null = null
function providerToken() {
  if (cached && Date.now() - cached.at < 50 * 60 * 1000) return cached.jwt
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID }))
  const claims = b64url(JSON.stringify({ iss: TEAM_ID, iat: Math.floor(Date.now() / 1000) }))
  const sig = sign('sha256', Buffer.from(`${head}.${claims}`), { key: createPrivateKey(KEY!), dsaEncoding: 'ieee-p1363' })
  cached = { jwt: `${head}.${claims}.${b64url(sig)}`, at: Date.now() }
  return cached.jwt
}

type Result = { status: number; reason?: string }

function post(host: string, token: string, payload: string, msg: ApnsMessage): Promise<Result> {
  return new Promise(resolve => {
    const client = http2.connect(`https://${host}`)
    client.on('error', () => resolve({ status: 0 }))
    const headers: http2.OutgoingHttpHeaders = {
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      authorization: `bearer ${providerToken()}`,
      'apns-topic': TOPIC,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': String(Math.floor(Date.now() / 1000) + 12 * 3600),
    }
    if (msg.tag) headers['apns-collapse-id'] = msg.tag.slice(0, 64)
    const req = client.request(headers)
    let status = 0, body = ''
    req.on('response', h => { status = Number(h[':status']) })
    req.setEncoding('utf8')
    req.on('data', d => { body += d })
    req.on('end', () => {
      client.close()
      let reason: string | undefined
      try { reason = body ? (JSON.parse(body) as { reason?: string }).reason : undefined } catch {}
      resolve({ status, reason })
    })
    req.on('error', () => { client.close(); resolve({ status: 0 }) })
    req.setTimeout(10_000, () => { req.close(); client.close(); resolve({ status: 0 }) })
    req.end(payload)
  })
}

const goneReason = (r: Result) => r.status === 410 || r.reason === 'BadDeviceToken' || r.reason === 'Unregistered' || r.reason === 'DeviceTokenNotForTopic'

/** Sends to each device token; returns tokens Apple says are dead. */
export async function sendApns(tokens: string[], msg: ApnsMessage) {
  if (!apnsConfigured() || !tokens.length) return { sent: 0, gone: [] as string[] }
  const payload = JSON.stringify({
    aps: {
      alert: { title: msg.title, body: msg.body },
      sound: 'default',
      ...(msg.tag ? { 'thread-id': msg.tag } : {}),
      'interruption-level': msg.urgent ? 'time-sensitive' : 'active',
    },
    url: msg.url,
  })
  const gone: string[] = []
  let sent = 0
  await Promise.all(tokens.map(async token => {
    let r = await post('api.push.apple.com', token, payload, msg)
    // A token from an Xcode (development) build only works against the sandbox.
    if (r.reason === 'BadDeviceToken') r = await post('api.sandbox.push.apple.com', token, payload, msg)
    if (r.status === 200) sent++
    else if (goneReason(r)) gone.push(token)
  }))
  return { sent, gone }
}
