import Image from "next/image";
import { photoFor, type Product } from "@/lib/company";
import ProductDrawing from "./ProductDrawing";

/**
 * A product image: the photograph when one exists, the drawing otherwise.
 *
 * Resolving that requires reading the filesystem, which makes this
 * server-only. The drawing itself lives in ProductDrawing so the spin viewer,
 * which is a client component, can render it directly.
 */
export default function ProductImage({
  product,
  className,
  compact,
}: {
  product: Product;
  className?: string;
  compact?: boolean;
}) {
  const photo = photoFor(product.id);

  if (!photo) {
    return (
      <ProductDrawing product={product} className={className} compact={compact} />
    );
  }

  /**
   * `fill` positions the image against its container, so the container needs a
   * height. An SVG carries its own aspect ratio from the viewBox and needs
   * none — which is why swapping drawings for photographs turned a working
   * layout into an invisible one on the detail page, silently. Supply a square
   * aspect unless the caller already gave a height.
   */
  const sized = /(?:^|\s)(?:h-|aspect-)/.test(className ?? "");

  return (
    <div
      className={`relative overflow-hidden ${sized ? "" : "aspect-square"} ${className ?? ""}`}
    >
      <Image
        src={photo}
        alt={`${product.name}, ${product.category}`}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 560px"
        className="object-cover"
        priority={!compact}
      />
    </div>
  );
}
