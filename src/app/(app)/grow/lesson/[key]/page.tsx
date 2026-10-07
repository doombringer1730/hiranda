import { notFound, redirect } from 'next/navigation'
import { coupleContext } from '@/lib/couple'
import { getPeople } from '@/lib/profiles'
import { lessonByKey, ALL_LESSONS } from '@/lib/path'
import LessonClient from './lesson-client'

export default async function LessonPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const lesson = lessonByKey(key)
  if (!lesson) notFound()
  const ctx = await coupleContext()
  if (!ctx) redirect('/')

  const [{ data: rows }, people] = await Promise.all([
    ctx.supabase.from('lesson_progress').select('user_id, note, completed_at').eq('couple_id', ctx.couple.id).eq('lesson_key', key),
    getPeople(),
  ])
  const mine = rows?.find(r => r.user_id === ctx.user.id) ?? null
  const theirs = rows?.find(r => r.user_id === ctx.partnerId) ?? null
  const idx = ALL_LESSONS.findIndex(l => l.key === key)
  const next = ALL_LESSONS[idx + 1] ?? null

  return (
    <LessonClient
      lessonKey={key}
      title={lesson.title}
      learn={lesson.learn}
      source={lesson.source}
      action={lesson.action}
      reflect={lesson.reflect}
      unit={{ title: lesson.unit.title, emoji: lesson.unit.emoji, color: lesson.unit.color }}
      step={{ n: lesson.unit.lessons.findIndex(l => l.key === key) + 1, of: lesson.unit.lessons.length }}
      partnerName={people.get(ctx.partnerId)?.first ?? 'your partner'}
      mine={mine ? { note: mine.note } : null}
      // Their reflection stays private until you've finished too.
      theirs={theirs ? { note: mine ? theirs.note : null } : null}
      next={next ? { key: next.key, title: next.title } : null}
    />
  )
}
