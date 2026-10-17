import 'server-only'
import { PRODUCTS, type Product } from './catalog'

// Every product the Store sells: the built-in catalog (catalog.ts), made by
// Printful or Gelato. Async so callers don't change if products ever come
// from the database again.

/** What shoppers can buy right now. */
export async function storeProducts(): Promise<Product[]> {
  return PRODUCTS
}

/** A product by key. */
export async function findProduct(key: string): Promise<Product | null> {
  return PRODUCTS.find(p => p.key === key) ?? null
}

/** Emoji/photo/title for any product, for order lists. */
export async function productLookup() {
  return (key: string) => PRODUCTS.find(p => p.key === key) ?? null
}
