import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductBySlug } from "@/lib/actions/products";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft } from "lucide-react";
import { OrderForm } from "./order-form";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: "商品未找到" };
  }

  return {
    title: `${product.name} - LDC Store`,
    description: product.description || product.name,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const isOutOfStock = product.stock === 0;
  const hasDiscount =
    product.originalPrice &&
    parseFloat(product.originalPrice) > parseFloat(product.price);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Back */}
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        返回首页
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{product.name}</h1>
            {product.description && (
              <p className="mt-1 text-muted-foreground">{product.description}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            {product.isFeatured && (
              <Badge variant="secondary">热门</Badge>
            )}
            {product.category && (
              <Badge variant="outline">{product.category.name}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Price & Stock */}
      <div className="mb-6 flex items-baseline justify-between rounded-lg border bg-muted/30 p-4">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">¥{product.price}</span>
          {hasDiscount && (
            <span className="text-sm text-muted-foreground line-through">
              ¥{product.originalPrice}
            </span>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {isOutOfStock ? (
            <span className="text-destructive">暂无库存</span>
          ) : (
            <span>库存 {product.stock} · 已售 {product.salesCount}</span>
          )}
        </div>
      </div>

      {/* Order Form */}
      {isOutOfStock ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="font-medium text-destructive">商品暂时缺货</p>
          <p className="mt-1 text-sm text-muted-foreground">请稍后再来查看</p>
        </div>
      ) : (
        <div className="rounded-lg border p-6">
          <OrderForm
            productId={product.id}
            productName={product.name}
            price={parseFloat(product.price)}
            stock={product.stock}
            minQuantity={product.minQuantity}
            maxQuantity={product.maxQuantity}
          />
        </div>
      )}

      {/* Product Content */}
      {product.content && (
        <>
          <Separator className="my-6" />
          <div>
            <h2 className="mb-3 font-medium">商品详情</h2>
            <div
              className="prose prose-sm prose-zinc max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: product.content }}
            />
          </div>
        </>
      )}
    </div>
  );
}
