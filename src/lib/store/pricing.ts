// Suggested prices and delivery wording for products added from suppliers.

/** Cost (product + shipping) → a price that covers Stripe's fee and leaves a
 *  real margin: about 2.2×, at least $9 over cost, ending in .99. */
export function suggestPrice(costCents: number) {
  const target = Math.max(costCents * 2.2, costCents + 900)
  return Math.ceil(target / 100) * 100 - 1
}

/** "5-11" (shipping days) → "Arrives in about 1–2 weeks", allowing a few
 *  days for the supplier to pack it. */
export function deliveryText(days: string) {
  const nums = days.split(/[^0-9]+/).map(Number).filter(Boolean)
  if (!nums.length) return 'Ships in about 2 weeks'
  const max = Math.max(...nums) + 3
  if (max <= 7) return 'Arrives in about a week'
  if (max <= 14) return 'Arrives in about 1–2 weeks'
  if (max <= 21) return 'Arrives in about 2–3 weeks'
  return 'Arrives in about 3–4 weeks'
}

/** A supplier's listing title → something friendlier to start from. */
export function tidyTitle(name: string) {
  const words = name
    .replace(/\b\d+(\.\d+)?\s*-?\s*\d*(\.\d+)?\s*(cm|mm|inch|in|pcs?|pieces?)\b/gi, ' ')
    .replace(/\b(new|hot|cross-border|creative|fashion|factory|source|wholesale)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}'&\s-]/gu, ' ')
    .split(/\s+/).filter(Boolean).slice(0, 6)
  const t = words.join(' ')
  return t ? t[0].toUpperCase() + t.slice(1) : 'A little gift'
}
