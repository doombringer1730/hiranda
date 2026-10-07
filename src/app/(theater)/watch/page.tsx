import { CLASSICS } from '@/theater/catalog/archive'
import { hasTmdb, trending } from '@/theater/catalog/tmdb'
import { DiscoverHome } from './discover'
import Sessions from './sessions'

// The Theater home: browse first (Stremio-style), then your sessions.
export default async function TheaterHome() {
  const trend = await trending()
  return (
    <>
      <DiscoverHome trending={trend} classics={CLASSICS} hasTmdb={hasTmdb()} />
      <Sessions />
    </>
  )
}
