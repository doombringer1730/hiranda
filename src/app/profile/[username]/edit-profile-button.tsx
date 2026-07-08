'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import ProfileEditor, { type EditableProfile } from '@/app/(app)/profile-editor'

export default function EditProfileButton({ profile }: { profile: EditableProfile }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-stone-800/80 hover:bg-stone-700 border border-stone-700 text-stone-200 text-sm rounded-xl px-3 py-2 transition-colors"
      >
        <Pencil size={14} /> Edit profile
      </button>
      {open && <ProfileEditor profile={profile} onClose={() => setOpen(false)} />}
    </>
  )
}
