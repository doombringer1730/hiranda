import { redirect } from 'next/navigation'

// The coin shop became the Coupon Book.
export default function ShopPage() {
  redirect('/grow/coupons')
}
