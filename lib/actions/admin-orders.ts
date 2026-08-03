"use server";

import {
  db,
  cards,
  orders,
  type Order,
  type CardStatus,
  type OrderStatus,
  type PaymentMethod,
  type PaymentProtocol,
  type RefundAttemptStatus,
} from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import { and, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";

export interface AdminOrdersFilters {
  status?: OrderStatus;
  paymentMethod?: PaymentMethod;
  query?: string;
}

export interface AdminOrderListItem {
  id: string;
  orderNo: string;
  productName: string;
  quantity: number;
  totalAmount: string;
  paymentMethod: PaymentMethod;
  username: string | null;
  userId: string | null;
  status: OrderStatus;
  tradeNo: string | null;
  refundReason: string | null;
  createdAt: string;
}

export interface AdminOrdersStats {
  pending: number;
  completed: number;
  refund_pending: number;
}

export interface AdminOrdersPageResult {
  items: AdminOrderListItem[];
  total: number;
  stats: AdminOrdersStats;
}

export interface AdminOrderDetailCardItem {
  id: string;
  content: string;
  status: CardStatus;
  lockedAt: string | null;
  soldAt: string | null;
  createdAt: string;
}

export interface AdminOrderDetail {
  id: string;
  orderNo: string;
  productId: string | null;
  productName: string;
  productPrice: string;
  quantity: number;
  totalAmount: string;
  paymentMethod: PaymentMethod;
  paymentProtocol: PaymentProtocol;
  status: OrderStatus;
  tradeNo: string | null;
  paymentReviewReason: string | null;
  paymentReviewTradeNo: string | null;
  paymentReviewAt: string | null;
  userId: string | null;
  username: string | null;
  email: string | null;
  remark: string | null;
  adminRemark: string | null;
  refundReason: string | null;
  paidAt: string | null;
  expiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  refundRequestedAt: string | null;
  refundedAt: string | null;
  refundAttemptStatus: RefundAttemptStatus | null;
  refundAttemptedAt: string | null;
  refundAttemptedBy: string | null;
  refundResponseCode: number | null;
  refundResponseMessage: string | null;
  cards: AdminOrderDetailCardItem[];
  product?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface AdminOrderDetailResult {
  success: boolean;
  message: string;
  data?: AdminOrderDetail;
}

export interface DeleteAdminOrdersResult {
  success: boolean;
  message: string;
  deletedCount?: number;
  notFoundCount?: number;
  notFoundIds?: string[];
}

type AdminOrdersRow = Pick<
  Order,
  | "id"
  | "orderNo"
  | "productName"
  | "quantity"
  | "totalAmount"
  | "paymentMethod"
  | "username"
  | "userId"
  | "status"
  | "tradeNo"
  | "refundReason"
  | "createdAt"
>;

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildAdminOrdersWhere(filters: AdminOrdersFilters) {
  const conditions: Array<SQL | undefined> = [];

  if (filters.status) {
    conditions.push(eq(orders.status, filters.status));
  }

  if (filters.paymentMethod) {
    conditions.push(eq(orders.paymentMethod, filters.paymentMethod));
  }

  const q = filters.query?.trim();
  if (q) {
    const pattern = `%${q}%`;
    // 为什么这样做：后台查单通常需要“一次输入，覆盖多个字段”，减少管理员反复切换筛选器的成本。
    conditions.push(
      or(
        ilike(orders.orderNo, pattern),
        ilike(orders.email, pattern),
        ilike(orders.username, pattern),
        ilike(orders.userId, pattern),
        ilike(orders.tradeNo, pattern),
        ilike(orders.productName, pattern)
      )
    );
  }

  const normalized = conditions.filter((condition): condition is SQL =>
    Boolean(condition)
  );
  if (normalized.length === 0) return undefined;
  return and(...normalized);
}

function serializeAdminOrdersRow(row: AdminOrdersRow): AdminOrderListItem {
  return {
    id: row.id,
    orderNo: row.orderNo,
    productName: row.productName,
    quantity: row.quantity,
    totalAmount: row.totalAmount,
    paymentMethod: row.paymentMethod,
    username: row.username ?? null,
    userId: row.userId ?? null,
    status: row.status,
    tradeNo: row.tradeNo ?? null,
    refundReason: row.refundReason ?? null,
    createdAt: toIsoString(row.createdAt) ?? "",
  };
}

function pickStatsFromGroupedCounts(
  grouped: Array<{ status: OrderStatus; count: number }>
): AdminOrdersStats {
  const map = new Map<OrderStatus, number>(
    grouped.map((row) => [row.status, row.count])
  );
  return {
    pending: map.get("pending") ?? 0,
    completed: map.get("completed") ?? 0,
    refund_pending: map.get("refund_pending") ?? 0,
  };
}

export async function getAdminOrdersPage(input: {
  page: number;
  pageSize: number;
  filters?: AdminOrdersFilters;
}): Promise<AdminOrdersPageResult> {
  await requireAdmin();

  const page = Math.max(1, Math.floor(input.page || 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(input.pageSize || 20)));
  const offset = (page - 1) * pageSize;

  const where = buildAdminOrdersWhere(input.filters ?? {});

  const [items, totalRow, groupedCounts] = await Promise.all([
    db.query.orders.findMany({
      columns: {
        id: true,
        orderNo: true,
        productName: true,
        quantity: true,
        totalAmount: true,
        paymentMethod: true,
        username: true,
        userId: true,
        status: true,
        tradeNo: true,
        refundReason: true,
        createdAt: true,
      },
      where,
      orderBy: (o, { desc }) => [desc(o.createdAt)],
      limit: pageSize,
      offset,
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(where)
      .then((rows) => rows[0]),
    db
      .select({
        status: orders.status,
        count: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(where)
      .groupBy(orders.status),
  ]);

  const total = totalRow?.count ?? 0;
  const stats = pickStatsFromGroupedCounts(groupedCounts);

  return {
    items: items.map(serializeAdminOrdersRow),
    total,
    stats,
  };
}

export async function deleteAdminOrders(orderIds: string[]): Promise<DeleteAdminOrdersResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "需要管理员权限" };
  }

  const uniqueIds = Array.from(new Set(orderIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { success: false, message: "未选择任何订单" };
  }

  if (uniqueIds.length > 200) {
    return { success: false, message: "单次最多删除 200 笔订单" };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const found = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(inArray(orders.id, uniqueIds));

      const foundIdSet = new Set(found.map((row) => row.id));
      const foundIds = Array.from(foundIdSet);
      const notFoundIds = uniqueIds.filter((id) => !foundIdSet.has(id));

      if (foundIds.length === 0) {
        return {
          deletedCount: 0,
          notFoundIds,
        };
      }

      // 释放未支付订单占用的卡密，避免删除后库存被“锁死”
      await tx
        .update(cards)
        .set({
          status: "available",
          orderId: null,
          lockedAt: null,
        })
        .where(and(eq(cards.status, "locked"), inArray(cards.orderId, foundIds)));

      const deleted = await tx
        .delete(orders)
        .where(inArray(orders.id, foundIds))
        .returning({ id: orders.id });

      return {
        deletedCount: deleted.length,
        notFoundIds,
      };
    });

    // 动态页通常无需 revalidate，但保留可兼容未来改为缓存页面的场景
    revalidatePath("/admin/orders");

    const deletedCount = result.deletedCount;
    const notFoundCount = result.notFoundIds.length;

    if (deletedCount === 0) {
      return {
        success: false,
        message: `未删除任何订单（可能已被删除）`,
        deletedCount,
        notFoundCount,
        notFoundIds: result.notFoundIds,
      };
    }

    return {
      success: true,
      message:
        notFoundCount > 0
          ? `已删除 ${deletedCount} 笔订单（${notFoundCount} 笔不存在或已删除）`
          : `已删除 ${deletedCount} 笔订单`,
      deletedCount,
      notFoundCount,
      notFoundIds: result.notFoundIds,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "删除订单失败，请稍后重试",
    };
  }
}

function serializeAdminOrderDetailCard(row: {
  id: string;
  content: string;
  status: CardStatus;
  lockedAt: unknown;
  soldAt: unknown;
  createdAt: unknown;
}): AdminOrderDetailCardItem {
  return {
    id: row.id,
    content: row.content,
    status: row.status,
    lockedAt: toIsoString(row.lockedAt),
    soldAt: toIsoString(row.soldAt),
    createdAt: toIsoString(row.createdAt) ?? "",
  };
}

export async function getAdminOrderDetail(orderId: string): Promise<AdminOrderDetailResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "需要管理员权限" };
  }

  const trimmedId = orderId.trim();
  if (!trimmedId) {
    return { success: false, message: "订单 ID 无效" };
  }

  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, trimmedId),
      with: {
        product: {
          columns: {
            id: true,
            name: true,
            slug: true,
          },
        },
        cards: {
          columns: {
            id: true,
            content: true,
            status: true,
            lockedAt: true,
            soldAt: true,
            createdAt: true,
          },
          orderBy: (c, { asc }) => [asc(c.createdAt)],
        },
      },
    });

    if (!order) {
      return { success: false, message: "订单不存在或已删除" };
    }

    return {
      success: true,
      message: "ok",
      data: {
        id: order.id,
        orderNo: order.orderNo,
        productId: order.productId ?? null,
        productName: order.productName,
        productPrice: order.productPrice,
        quantity: order.quantity,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        paymentProtocol: order.paymentProtocol,
        status: order.status,
        tradeNo: order.tradeNo ?? null,
        paymentReviewReason: order.paymentReviewReason ?? null,
        paymentReviewTradeNo: order.paymentReviewTradeNo ?? null,
        paymentReviewAt: toIsoString(order.paymentReviewAt),
        userId: order.userId ?? null,
        username: order.username ?? null,
        email: order.email ?? null,
        remark: order.remark ?? null,
        adminRemark: order.adminRemark ?? null,
        refundReason: order.refundReason ?? null,
        paidAt: toIsoString(order.paidAt),
        expiredAt: toIsoString(order.expiredAt),
        createdAt: toIsoString(order.createdAt) ?? "",
        updatedAt: toIsoString(order.updatedAt) ?? "",
        refundRequestedAt: toIsoString(order.refundRequestedAt),
        refundedAt: toIsoString(order.refundedAt),
        refundAttemptStatus: order.refundAttemptStatus ?? null,
        refundAttemptedAt: toIsoString(order.refundAttemptedAt),
        refundAttemptedBy: order.refundAttemptedBy ?? null,
        refundResponseCode: order.refundResponseCode ?? null,
        refundResponseMessage: order.refundResponseMessage ?? null,
        cards: order.cards.map(serializeAdminOrderDetailCard),
        product: order.product
          ? {
              id: order.product.id,
              name: order.product.name,
              slug: order.product.slug,
            }
          : null,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "获取订单详情失败，请稍后重试",
    };
  }
}
