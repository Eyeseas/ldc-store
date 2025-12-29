import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

interface ProductCardProps {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: string;
  originalPrice?: string | null;
  coverImage?: string | null;
  stock: number;
  isFeatured?: boolean;
  salesCount?: number;
  category?: {
    name: string;
    slug: string;
  } | null;
}

export function ProductCard({
  name,
  slug,
  price,
  originalPrice,
  stock,
  isFeatured,
  category,
}: ProductCardProps) {
  const isOutOfStock = stock === 0;
  const hasDiscount = originalPrice && parseFloat(originalPrice) > parseFloat(price);

  return (
    <Link
      href={`/product/${slug}`}
      className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/50"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{name}</span>
          {isFeatured && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              热门
            </Badge>
          )}
          {isOutOfStock && (
            <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">
              售罄
            </Badge>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          {category && <span>{category.name}</span>}
          {category && <span>·</span>}
          <span>库存 {stock}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <div className="font-semibold">¥{price}</div>
          {hasDiscount && (
            <div className="text-xs text-muted-foreground line-through">
              ¥{originalPrice}
            </div>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}
