'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

type MemoryPin = {
  id: string
  title: string
  happened_at: string
  location_name: string | null
  latitude: number
  longitude: number
}

type Props = { memories: MemoryPin[] }

type PopupState = { memory: MemoryPin; x: number; y: number } | null

export default function MapView({ memories }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<import('leaflet').Map | null>(null)
  const [popup, setPopup] = useState<PopupState>(null)

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return

    async function init() {
      const L = (await import('leaflet')).default

      if (!mapRef.current) return

      const center: [number, number] = memories.length > 0
        ? [memories[0].latitude, memories[0].longitude]
        : [20, 0]

      const map = L.map(mapRef.current, { zoomControl: true }).setView(center, memories.length > 0 ? 5 : 2)
      leafletMapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      // Custom amber pin icon
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:12px;height:12px;background:#b45309;border:2px solid #fef3c7;border-radius:50%;box-shadow:0 0 0 2px rgba(180,83,9,0.3)"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      })

      memories.forEach(memory => {
        const marker = L.marker([memory.latitude, memory.longitude], { icon }).addTo(map)
        marker.on('click', (e) => {
          const point = map.latLngToContainerPoint(e.latlng)
          setPopup({ memory, x: point.x, y: point.y })
        })
      })

      map.on('click', () => setPopup(null))

      // Fit bounds if multiple memories
      if (memories.length > 1) {
        const bounds = L.latLngBounds(memories.map(m => [m.latitude, m.longitude]))
        map.fitBounds(bounds, { padding: [40, 40] })
      }
    }

    init()

    return () => {
      leafletMapRef.current?.remove()
      leafletMapRef.current = null
    }
  }, [memories])

  return (
    <div className="relative w-full h-[calc(100vh-5rem)]">
      <div ref={mapRef} className="w-full h-full rounded-2xl overflow-hidden" />

      {popup && (
        <div
          className="absolute z-[1000] bg-stone-900 border border-stone-700 rounded-xl p-3 w-52 shadow-xl"
          style={{
            left: Math.min(popup.x + 12, (mapRef.current?.clientWidth ?? 400) - 220),
            top: Math.max(popup.y - 80, 8),
          }}
        >
          <button
            onClick={() => setPopup(null)}
            className="absolute right-2 top-2 text-stone-500 hover:text-stone-300"
          >
            <X size={12} />
          </button>
          {popup.memory.location_name && (
            <p className="text-stone-500 text-xs mb-1 flex items-center gap-1">
              📍 {popup.memory.location_name}
            </p>
          )}
          <Link href={`/memories/${popup.memory.id}`} className="block">
            <p className="text-amber-100 text-sm font-medium leading-tight hover:text-amber-300 transition-colors pr-4">
              {popup.memory.title}
            </p>
            <p className="text-stone-500 text-xs mt-1">
              {new Date(popup.memory.happened_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
              })}
            </p>
          </Link>
        </div>
      )}

      {memories.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-stone-900/90 border border-stone-800 rounded-2xl px-6 py-4 text-center">
            <p className="text-stone-400 text-sm">No memories with locations yet.</p>
            <p className="text-stone-600 text-xs mt-1">Add a location when creating a memory.</p>
          </div>
        </div>
      )}
    </div>
  )
}
