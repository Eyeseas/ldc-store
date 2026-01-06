import { Suspense } from "react";
import { ProductCard } from "@/components/store/product-card";
import { getActiveProducts } from "@/lib/actions/products";
import { getActiveCategories } from "@/lib/actions/categories";
import { getActiveAnnouncements } from "@/lib/actions/announcements";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package } from "lucide-react";
import { AnnouncementBanner } from "@/components/store/announcement-banner";
import { renderMarkdownToSafeHtml } from "@/lib/markdown";

// ISR: 每 60 秒重新验证页面缓存
// 这样既保持了性能（CDN 缓存），又确保数据在 60 秒内更新
export const revalidate = 60;

async function ProductList() {
  const products = await getActiveProducts({
    limit: 20,
  });

  if (products.length === 0) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Package className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">暂无商品</p>
        <p className="text-sm mt-1">请稍后再来看看吧</p>
      </div>
    );
  }

  return (
    <>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          id={product.id}
          name={product.name}
          slug={product.slug}
          description={product.description}
          price={product.price}
          originalPrice={product.originalPrice}
          coverImage={product.coverImage}
          stock={product.stock}
          isFeatured={product.isFeatured}
          salesCount={product.salesCount}
          category={product.category}
        />
      ))}
    </>
  );
}

async function CategoryTabs({ currentCategory }: { currentCategory?: string }) {
  const categories = await getActiveCategories();

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      <Link href="/">
        <Button
          variant={!currentCategory ? "default" : "outline"}
          size="sm"
          className={`shrink-0 rounded-full transition-all ${
            !currentCategory 
              ? "shadow-md shadow-primary/20" 
              : "hover:bg-muted"
          }`}
        >
          全部商品
        </Button>
      </Link>
      {categories.map((category) => (
        <Link key={category.id} href={`/category/${category.slug}`}>
          <Button 
            variant="outline" 
            size="sm" 
            className="shrink-0 rounded-full hover:bg-muted transition-all"
          >
            {category.name}
          </Button>
        </Link>
      ))}
    </div>
  );
}

function ProductGridSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm"
        >
          <Skeleton className="aspect-[4/3] w-full" />
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
            <div className="flex flex-wrap gap-2 pt-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

export default async function HomePage() {
  const announcements = await getActiveAnnouncements();
  const bannerItems = announcements.map((a) => ({
    id: a.id,
    title: a.title,
    // 关键：在服务端完成 Markdown → 安全 HTML，避免把 sanitize-html 打进客户端包
    contentHtml: renderMarkdownToSafeHtml(a.content),
    updatedAt: a.updatedAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AnnouncementBanner announcements={bannerItems} />

      {/* Categories */}
      <div className="mb-8">
        <Suspense fallback={<Skeleton className="h-9 w-64" />}>
          <CategoryTabs />
        </Suspense>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <Suspense fallback={<ProductGridSkeleton />}>
          <ProductList />
        </Suspense>
      </div>
    </div>
  );
}
