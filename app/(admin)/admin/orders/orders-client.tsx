import Link from "next/link";

import { Button } from "@/components/ui/button";

import type { AdminOrderListItem } from "@/lib/actions/admin-orders";
import type { OrderStatus, PaymentMethod } from "@/lib/db";

import { OrdersFilters } from "./orders-filters";
import { OrdersPagination } from "./orders-pagination";
import { OrdersTable } from "./orders-table";

export function OrdersClient({
  items,
  total,
  page,
  pageSize,
  totalPages,
  q,
  status,
  paymentMethod,
  refundEnabled,
}: {
  items: AdminOrderListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q: string;
  status?: OrderStatus;
  paymentMethod?: PaymentMethod;
  refundEnabled: boolean;
}) {
  const hasActiveFilters = Boolean(q || status || paymentMethod);

  return (
    <div className="space-y-4">
      <OrdersFilters
        q={q}
        status={status}
        paymentMethod={paymentMethod}
        pageSize={pageSize}
      />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          共 {total} 条 · 第 {page}/{totalPages} 页
        </span>
        {hasActiveFilters ? <span className="text-xs">已启用筛选条件</span> : null}
      </div>

      {items.length > 0 ? (
        <OrdersTable
          // 为什么这样做：分页/筛选切换后应清空“上一页的选中状态”，同时避免在 effect 中同步 setState 引发级联渲染警告
          key={`${page}:${pageSize}:${q}:${status ?? ""}:${paymentMethod ?? ""}`}
          items={items}
          refundEnabled={refundEnabled}
        />
      ) : (
        <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
          <p>{hasActiveFilters ? "没有匹配的订单" : "暂无订单"}</p>
          {hasActiveFilters ? (
            <div className="mt-3">
              <Button asChild variant="outline">
                <Link href="/admin/orders">清除筛选</Link>
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <OrdersPagination
        q={q}
        status={status}
        paymentMethod={paymentMethod}
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
      />
    </div>
  );
}
