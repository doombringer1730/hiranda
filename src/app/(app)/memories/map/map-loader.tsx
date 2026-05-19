'use client'

import dynamic from 'next/dynamic'

const MapView = dynamic(() => import('../map-view'), { ssr: false })

type MemoryPin = {
  id: string
  title: string
  happened_at: string
  location_name: string | null
  latitude: number
  longitude: number
}

export default function MapLoader({ memories }: { memories: MemoryPin[] }) {
  return <MapView memories={memories} />
}
