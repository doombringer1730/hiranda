'use client'

import { useEffect, useState } from 'react'
import { addBook } from './actions'
import Link from 'next/link'
import { Plus, BookOpen, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Book = { id: string; title: string; author: string | null; cover_path: string | null; coverUrl?: string }

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [epubFile, setEpubFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadBooks()
  }, [])

  async function loadBooks() {
    const supabase = createClient()
    const { data } = await supabase
      .from('books')
      .select('id, title, author, cover_path')
      .order('created_at', { ascending: false })

    if (!data) return

    const withCovers = await Promise.all(
      data.map(async (book) => {
        if (!book.cover_path) return { ...book, coverUrl: undefined }
        const { data: signed } = await supabase.storage
          .from('epubs')
          .createSignedUrl(book.cover_path, 3600)
        return { ...book, coverUrl: signed?.signedUrl }
      })
    )
    setBooks(withCovers)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!epubFile || !title.trim()) return
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not logged in'); setSaving(false); return }

    const epubExt = epubFile.name.split('.').pop() ?? 'epub'
    const epubPath = `${user.id}/epub/${Date.now()}.${epubExt}`
    const { error: epubError } = await supabase.storage
      .from('epubs')
      .upload(epubPath, epubFile, { contentType: epubFile.type })
    if (epubError) { setError(`Upload failed: ${epubError.message}`); setSaving(false); return }

    let coverPath: string | null = null
    if (coverFile) {
      const coverExt = coverFile.name.split('.').pop() ?? 'jpg'
      coverPath = `${user.id}/cover/${Date.now()}.${coverExt}`
      const { error: coverError } = await supabase.storage
        .from('epubs')
        .upload(coverPath, coverFile, { contentType: coverFile.type })
      if (coverError) coverPath = null
    }

    const result = await addBook({ title: title.trim(), author: author.trim(), epubPath, coverPath })
    if ('error' in result) { setError(result.error ?? 'Failed'); setSaving(false); return }

    router.push(`/library/${result.bookId}`)
  }

  return (
    <div className="px-4 pt-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-serif text-3xl text-amber-100">Library</h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add book'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-stone-900 border border-stone-800 rounded-2xl p-5 mb-8 flex flex-col gap-4">
          <h3 className="font-serif text-lg text-amber-200">Add a book</h3>
          {error && <p className="text-red-400 text-sm bg-red-950/30 rounded-xl px-4 py-3">{error}</p>}

          <input type="text" required placeholder="Title" value={title} onChange={e => setTitle(e.target.value)}
            className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors" />

          <input type="text" placeholder="Author" value={author} onChange={e => setAuthor(e.target.value)}
            className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors" />

          <div className="flex flex-col gap-1">
            <label className="text-stone-400 text-xs uppercase tracking-widest">EPUB file</label>
            <input type="file" required accept=".epub,application/epub+zip" onChange={e => setEpubFile(e.target.files?.[0] ?? null)}
              className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-stone-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-amber-900/40 file:text-amber-300 file:text-sm cursor-pointer" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-stone-400 text-xs uppercase tracking-widest">Cover image (optional)</label>
            <input type="file" accept="image/*" onChange={e => setCoverFile(e.target.files?.[0] ?? null)}
              className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-stone-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-amber-900/40 file:text-amber-300 file:text-sm cursor-pointer" />
          </div>

          <button type="submit" disabled={saving || !epubFile || !title.trim()}
            className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Uploading…</> : 'Add to library'}
          </button>
        </form>
      )}

      {books.length === 0 && !showForm && (
        <div className="text-center py-24">
          <BookOpen size={40} className="mx-auto text-stone-700 mb-4" />
          <p className="text-stone-500">No books yet. Add your first one.</p>
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
        {books.map((book) => (
          <Link key={book.id} href={`/library/${book.id}`} className="flex flex-col gap-2 group">
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-stone-800 border border-stone-700 group-hover:border-amber-700 transition-colors flex items-center justify-center">
              {book.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-amber-900/60 to-stone-800 flex items-end p-3">
                  <p className="text-amber-200 text-xs font-serif leading-tight line-clamp-3">{book.title}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-amber-100 text-xs font-medium leading-tight line-clamp-2 group-hover:text-amber-300 transition-colors">{book.title}</p>
              {book.author && <p className="text-stone-500 text-xs mt-0.5 line-clamp-1">{book.author}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
