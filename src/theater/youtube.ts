// YouTube link parsing — safe on server and client.

const ID = /^[A-Za-z0-9_-]{11}$/

/** The 11-character video id from any common YouTube URL (or a bare id). */
export function youTubeId(input: string | null | undefined): string | null {
  if (!input) return null
  const s = input.trim()
  if (ID.test(s)) return s
  let url: URL
  try { url = new URL(s) } catch { return null }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '')
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0]
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else {
      const m = url.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/)
      if (m) id = m[2]
    }
  }
  return id && ID.test(id) ? id : null
}

export const youTubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`
export const youTubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
