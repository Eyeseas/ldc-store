export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { isRefundEnabled } from "@/lib/payment/ldc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, CheckCircle2, Clock, RotateCcw } from "lucide-react";

import {
  getAdminOrdersPage,
  type AdminOrdersFilters,
} from "@/lib/actions/admin-orders";
import {
  orderStatusEnum,
  paymentMethodEnum,
  type OrderStatus,
  type PaymentMethod,
} from "@/lib/db";

import { OrdersClient } from "./orders-client";
import {
  buildAdminOrdersHref,
  DEFAULT_ADMIN_ORDERS_PAGE_SIZE,
} from "./orders-url";

function normalizePage(value?: string): number {
  return Math.max(1, Number.parseInt(value || "1", 10) || 1);
}

function normalizePageSize(value?: string): number {
  const parsed = Number.parseInt(
    value || String(DEFAULT_ADMIN_ORDERS_PAGE_SIZE),
    10
  );
  const safe = Number.isFinite(parsed) ? parsed : DEFAULT_ADMIN_ORDERS_PAGE_SIZE;
  return Math.min(200, Math.max(1, safe));
}

function normalizeEnumValue<T extends readonly string[]>(
  value: string | undefined,
  allowed: T
): T[number] | undefined {
  if (!value) return undefined;
  return allowed.includes(value) ? (value as T[number]) : undefined;
}

interface OrdersPageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    paymentMethod?: string;
    page?: string;
    pageSize?: string;
  }>;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;

  const q = (params.q || "").trim();
  const status = normalizeEnumValue(
    params.status,
    orderStatusEnum.enumValues
  ) as OrderStatus | undefined;
  const paymentMethod = normalizeEnumValue(
    params.paymentMethod,
    paymentMethodEnum.enumValues
  ) as PaymentMethod | undefined;

  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.pageSize);

  const filters: AdminOrdersFilters = {
    status,
    paymentMethod,
    query: q || undefined,
  };

  const result = await getAdminOrdersPage({ page, pageSize, filters });
  const totalPages = Math.max(1, Math.ceil(result.total / pageSize));
  if (result.total > 0 && page > totalPages) {
    redirect(
      buildAdminOrdersHref({
        q: q || undefined,
        status,
        paymentMethod,
        page: totalPages,
        pageSize,
      })
    );
  }
  const safePage = Math.min(page, totalPages);

  const refundEnabled = isRefundEnabled();

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            订单管理
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            查看和管理所有订单
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="py-4">
            <CardContent className="px-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/40">
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-semibold leading-none text-zinc-900 dark:text-zinc-50">
                    {result.stats.pending}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    待支付
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="px-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/40">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-semibold leading-none text-zinc-900 dark:text-zinc-50">
                    {result.stats.completed}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    已完成
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="px-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-950/40">
                  <RotateCcw className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-semibold leading-none text-zinc-900 dark:text-zinc-50">
                    {result.stats.refund_pending}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    待审核退款
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-5 w-5" />
            订单列表 ({result.total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OrdersClient
            items={result.items}
            total={result.total}
            page={safePage}
            pageSize={pageSize}
            totalPages={totalPages}
            q={q}
            status={status}
            paymentMethod={paymentMethod}
            refundEnabled={refundEnabled}
          />
        </CardContent>
      </Card>
    </div>
  );
}
