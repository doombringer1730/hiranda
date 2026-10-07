import { redirect } from 'next/navigation'
import { getReviewDeck } from '../actions'
import ReviewClient from './review-client'

export default async function LoveMapReviewPage() {
  const deck = await getReviewDeck()
  if (!deck) redirect('/grow')
  return <ReviewClient partnerName={deck.partnerName} cards={deck.cards} />
}
