// A product's photo, or its emoji when it has none.
export default function ProductThumb({ product, size = 44 }: { product: { image?: string; emoji: string } | null; size?: number }) {
  if (product?.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={product.image} alt="" width={size} height={size} loading="lazy"
        className="shrink-0 rounded-xl object-cover bg-stone-800" style={{ width: size, height: size }} />
    )
  }
  return <span className="shrink-0 text-center leading-none" style={{ fontSize: size * 0.72, width: size }} aria-hidden="true">{product?.emoji ?? '🎁'}</span>
}
