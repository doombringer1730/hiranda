import { redirect } from 'next/navigation'
import { getJar } from './actions'
import JarClient from './jar-client'

export default async function JarPage() {
  const state = await getJar()
  if (!state) redirect('/games')
  return <JarClient initial={state} />
}
