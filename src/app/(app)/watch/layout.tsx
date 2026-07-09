import { redirect } from 'next/navigation'
import { getTheaterState } from '@/lib/theater'

// Gate the whole Theater (watch/sync + streaming sources) behind the passcode.
// Locked → bounce to Settings, where you set/enter the passcode.
export default async function WatchLayout({ children }: { children: React.ReactNode }) {
  const { unlocked } = await getTheaterState()
  if (!unlocked) redirect('/settings?theater=locked')
  return <>{children}</>
}
