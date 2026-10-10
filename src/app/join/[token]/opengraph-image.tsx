import { ogCard, ogSize } from '../../og-card'
import { invitePreview } from '@/lib/invite'

export const alt = 'An invitation to Hiranda'
export const size = ogSize
export const contentType = 'image/png'

// The link preview when an invite is pasted into Messages, WhatsApp…
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const name = (await invitePreview(token))?.name
  return ogCard(name ? `${name} saved you a seat.` : 'Your partner saved you a seat.')
}
