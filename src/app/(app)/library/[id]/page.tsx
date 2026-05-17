import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EpubReader from './epub-reader'
import { deleteBook } from '../actions'
import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: book } = await supabase.from('books').select('*').eq('id', id).single()
  if (!book) notFound()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: epubSigned } = await supabase.storage
    .from('epubs')
    .createSignedUrl(book.epub_path, 7200)
  if (!epubSigned?.signedUrl) notFound()

  const { data: progress } = await supabase
    .from('reading_progress')
    .select('cfi')
    .eq('book_id', id)
    .eq('user_id', user!.id)
    .single()

  return (
    <div className="flex flex-col h-screen bg-stone-950">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800 flex-shrink-0">
        <Link href="/library" className="text-stone-500 hover:text-amber-400 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="text-center flex-1 mx-4">
          <p className="font-serif text-amber-100 text-sm truncate">{book.title}</p>
          {book.author && <p className="text-stone-500 text-xs">{book.author}</p>}
        </div>
        <form action={deleteBook.bind(null, id, book.epub_path, book.cover_path)}>
          <button type="submit" className="text-stone-600 hover:text-red-400 transition-colors p-1">
            <Trash2 size={18} />
          </button>
        </form>
      </div>

      <EpubReader
        bookId={id}
        epubUrl={epubSigned.signedUrl}
        initialCfi={progress?.cfi ?? null}
      />
    </div>
  )
}
