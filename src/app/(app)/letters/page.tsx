import { redirect } from 'next/navigation'
import { getLetters } from './actions'
import LettersClient from './letters-client'

export default async function LettersPage() {
  const state = await getLetters()
  if (!state) redirect('/')
  return <LettersClient initial={state} />
}
