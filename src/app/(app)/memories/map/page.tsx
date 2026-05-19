import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import MapLoader from './map-loader'

export default async function MemoryMapPage() {
  const supabase = await createClient()

  const { data: memories } = await supabase
    .from('memories')
    .select('id, title, happened_at, location_name, latitude, longitude')
    .not('latitude', 'is', null)
    .order('happened_at', { ascending: false })

  const pins = (memories ?? []).filter(
    m => m.latitude != null && m.longitude != null
  ) as { id: string; title: string; happened_at: string; location_name: string | null; latitude: number; longitude: number }[]

  return (
    <div className="px-4 pt-8 max-w-5xl mx-auto pb-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-stone-500 hover:text-amber-400 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="font-serif text-3xl text-amber-100">Memory Map</h2>
        <span className="text-stone-600 text-sm ml-1">{pins.length} location{pins.length !== 1 ? 's' : ''}</span>
      </div>
      <MapLoader memories={pins} />
    </div>
  )
}
