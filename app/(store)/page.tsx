import { Suspense } from "react";
import { ProductCard } from "@/components/store/product-card";
import { getActiveProducts } from "@/lib/actions/products";
import { getActiveCategories } from "@/lib/actions/categories";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface HomePageProps {
  searchParams: Promise<{ search?: string }>;
}

async function ProductList({ search }: { search?: string }) {
  const products = await getActiveProducts({
    search,
    limit: 20,
  });

  if (products.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        {search ? `未找到 "${search}" 相关商品` : "暂无商品"}
      </div>
    );
  }

  return (
    <div className="divide-y">
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
    </div>
  );
}

async function CategoryTabs({ currentCategory }: { currentCategory?: string }) {
  const categories = await getActiveCategories();

  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      <Link href="/">
        <Button
          variant={!currentCategory ? "secondary" : "ghost"}
          size="sm"
          className="shrink-0"
        >
          全部
        </Button>
      </Link>
      {categories.map((category) => (
        <Link key={category.id} href={`/category/${category.slug}`}>
          <Button variant="ghost" size="sm" className="shrink-0">
            {category.name}
          </Button>
        </Link>
      ))}
    </div>
  );
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { search } = await searchParams;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">

      {/* Search Header */}
      {search && (
        <div className="mb-4 flex items-center gap-3">
          <span className="text-muted-foreground">搜索:</span>
          <span className="font-medium">{search}</span>
          <Link href="/">
            <Button variant="ghost" size="sm">
              清除
            </Button>
          </Link>
        </div>
      )}

      {/* Categories */}
      {!search && (
        <div className="mb-4">
          <Suspense fallback={<Skeleton className="h-9 w-full" />}>
            <CategoryTabs />
          </Suspense>
        </div>
      )}

      {/* Products */}
      <div className="rounded-lg border">
        <Suspense
          fallback={
            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="mt-2 h-4 w-24" />
                </div>
              ))}
            </div>
          }
        >
          <ProductList search={search} />
        </Suspense>
      </div>
    </div>
  );
}
