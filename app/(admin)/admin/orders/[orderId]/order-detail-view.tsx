import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Coins,
  CreditCard,
  ExternalLink,
  Hash,
  Package,
  User,
  Users,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LocalTime } from "@/components/time/local-time";

import type { AdminOrderDetailResult } from "@/lib/actions/admin-orders";
import type { CardStatus } from "@/lib/db";
import { cn } from "@/lib/utils";

import { orderStatusConfig, paymentMethodLabels } from "../order-meta";
import { CopyIconButton } from "./copy-icon-button";
import { CopyTextButton } from "./copy-text-button";

type OrderDetailData = NonNullable<AdminOrderDetailResult["data"]>;

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="min-w-0 text-sm text-foreground">{children}</div>
    </div>
  );
}

const cardStatusMeta: Record<CardStatus, { label: string; className: string }> = {
  available: {
    label: "可用",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  },
  locked: {
    label: "已锁定",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  },
  sold: {
    label: "已售出",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  refunded: {
    label: "已退款",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  },
};

function SummaryCard({
  icon,
  iconClassName,
  title,
  value,
  description,
  action,
}: {
  icon: ReactNode;
  iconClassName: string;
  title: string;
  value: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              iconClassName
            )}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-lg font-semibold leading-none text-zinc-900 dark:text-zinc-50"
              title={value}
            >
              {value}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {title}
            </p>
            {description ? (
              <div className="mt-2 text-xs text-muted-foreground">
                {description}
              </div>
            ) : null}
          </div>
          {action ? <div className="ml-auto">{action}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function NoteBlock({
  title,
  content,
  tone = "default",
}: {
  title: string;
  content: string | null | undefined;
  tone?: "default" | "warning";
}) {
  const normalized = content?.trim();
  const display = normalized ? normalized : "—";

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
          : "bg-muted/30"
      )}
    >
      <div className="text-sm font-medium">{title}</div>
      <div
        className={cn(
          "mt-2 whitespace-pre-wrap text-sm",
          tone === "warning" ? "text-amber-800 dark:text-amber-200" : "text-muted-foreground"
        )}
      >
        {display}
      </div>
    </div>
  );
}

function OrderHeader({ order }: { order: OrderDetailData }) {
  const statusMeta = orderStatusConfig[order.status];
  const isGuestOrder = Boolean(order.email && !order.userId);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <Button asChild variant="outline" size="icon">
          <Link href="/admin/orders" aria-label="返回订单列表">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              订单详情
            </h1>
            <Badge className={statusMeta.color}>{statusMeta.label}</Badge>
            {isGuestOrder ? <Badge variant="secondary">游客订单</Badge> : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="text-xs">订单号</span>
              <code className="font-mono">{order.orderNo}</code>
              <CopyIconButton
                text={order.orderNo}
                ariaLabel="复制订单号"
                className="opacity-80 hover:opacity-100"
              />
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="text-xs">下单时间</span>
              <LocalTime value={order.createdAt} mode="short" />
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="text-xs">金额</span>
              <span className="font-semibold text-foreground">
                {order.totalAmount} LDC
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {order.product ? (
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={`/admin/products/${order.product.id}/edit`}>
              <ExternalLink className="h-4 w-4" />
              查看商品
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function OrderSummary({ order }: { order: OrderDetailData }) {
  const paymentLabel =
    paymentMethodLabels[order.paymentMethod] || order.paymentMethod;
  const userLabel = order.username || order.email || "—";

  const tradeNo = order.tradeNo?.trim() ? order.tradeNo.trim() : null;
  const userId = order.userId?.trim() ? order.userId.trim() : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        icon={<Coins className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />}
        iconClassName="bg-emerald-100 dark:bg-emerald-950/40"
        title="订单金额"
        value={`${order.totalAmount} LDC`}
        description={
          <span>
            单价 {order.productPrice} · 数量 {order.quantity}
          </span>
        }
      />
      <SummaryCard
        icon={<Package className="h-4 w-4 text-amber-700 dark:text-amber-300" />}
        iconClassName="bg-amber-100 dark:bg-amber-950/40"
        title="商品"
        value={order.productName}
        description={<span>× {order.quantity}</span>}
      />
      <SummaryCard
        icon={<CreditCard className="h-4 w-4 text-blue-700 dark:text-blue-300" />}
        iconClassName="bg-blue-100 dark:bg-blue-950/40"
        title="支付方式"
        value={paymentLabel}
        description={
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-xs">支付单号</span>
            <code
              className="min-w-0 flex-1 truncate font-mono text-[11px]"
              title={tradeNo ?? ""}
            >
              {tradeNo ?? "—"}
            </code>
            {tradeNo ? (
              <CopyIconButton
                text={tradeNo}
                ariaLabel="复制支付平台订单号"
                className="opacity-80 hover:opacity-100"
              />
            ) : null}
          </div>
        }
      />
      <SummaryCard
        icon={<Users className="h-4 w-4 text-purple-700 dark:text-purple-300" />}
        iconClassName="bg-purple-100 dark:bg-purple-950/40"
        title="用户"
        value={userLabel}
        description={
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-xs">用户 ID</span>
            <code
              className="min-w-0 flex-1 truncate font-mono text-[11px]"
              title={userId ?? ""}
            >
              {userId ?? "—"}
            </code>
            {userId ? (
              <CopyIconButton
                text={userId}
                ariaLabel="复制用户 ID"
                className="opacity-80 hover:opacity-100"
              />
            ) : null}
          </div>
        }
      />
    </div>
  );
}

function OrderInfoCard({ order }: { order: OrderDetailData }) {
  const paymentLabel =
    paymentMethodLabels[order.paymentMethod] || order.paymentMethod;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Hash className="h-5 w-5" />
          订单信息
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="订单 ID">
          <div className="flex min-w-0 items-center gap-2">
            <code
              className="min-w-0 flex-1 truncate font-mono text-xs"
              title={order.id}
            >
              {order.id}
            </code>
            <CopyIconButton
              text={order.id}
              ariaLabel="复制订单 ID"
              className="opacity-80 hover:opacity-100"
            />
          </div>
        </Field>
        <Field label="订单号">
          <div className="flex min-w-0 items-center gap-2">
            <code
              className="min-w-0 flex-1 truncate font-mono text-xs"
              title={order.orderNo}
            >
              {order.orderNo}
            </code>
            <CopyIconButton
              text={order.orderNo}
              ariaLabel="复制订单号"
              className="opacity-80 hover:opacity-100"
            />
          </div>
        </Field>
        <Field label="支付方式">{paymentLabel}</Field>
        <Field label="支付协议">
          <code className="font-mono text-xs">{order.paymentProtocol}</code>
        </Field>
        <Field label="订单状态">
          <Badge className={orderStatusConfig[order.status].color}>
            {orderStatusConfig[order.status].label}
          </Badge>
        </Field>
        <Field label="支付平台订单号">
          <div className="flex min-w-0 items-center gap-2">
            <code
              className="min-w-0 flex-1 truncate font-mono text-xs"
              title={order.tradeNo ?? ""}
            >
              {order.tradeNo ?? "—"}
            </code>
            {order.tradeNo ? (
              <CopyIconButton
                text={order.tradeNo}
                ariaLabel="复制支付平台订单号"
                className="opacity-80 hover:opacity-100"
              />
            ) : null}
          </div>
        </Field>
        <Field label="商品">{order.productName}</Field>
        <Field label="数量">{order.quantity}</Field>
        <Field label="单价">{order.productPrice} LDC</Field>
        <Field label="金额">{order.totalAmount} LDC</Field>
      </CardContent>
    </Card>
  );
}

function OrderNotesCard({ order }: { order: OrderDetailData }) {
  const refundAttemptLabels = {
    processing: "处理中",
    succeeded: "平台已确认成功",
    failed: "平台明确失败",
    uncertain: "结果待人工核对",
  } as const;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">备注与退款</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {order.refundReason ? (
          <NoteBlock title="退款原因" content={order.refundReason} tone="warning" />
        ) : null}
        {order.paymentReviewReason ? (
          <NoteBlock
            title="支付人工核对"
            content={`${order.paymentReviewReason} · 交易号 ${order.paymentReviewTradeNo ?? "未知"}`}
            tone="warning"
          />
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <NoteBlock title="用户备注" content={order.remark} />
          <NoteBlock title="管理员备注" content={order.adminRemark} />
        </div>
        {order.refundAttemptStatus ? (
          <div className="grid gap-3 rounded-md border p-3 text-sm md:grid-cols-2">
            <Field label="退款尝试状态">
              {refundAttemptLabels[order.refundAttemptStatus]}
            </Field>
            <Field label="操作管理员 ID">
              <code className="font-mono text-xs">
                {order.refundAttemptedBy ?? "—"}
              </code>
            </Field>
            <Field label="平台响应码">
              {order.refundResponseCode ?? "—"}
            </Field>
            <Field label="平台响应">
              {order.refundResponseMessage ?? "—"}
            </Field>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function OrderCardsCard({
  order,
  cardCounts,
}: {
  order: OrderDetailData;
  cardCounts: Record<CardStatus, number>;
}) {
  const canCopyAll = order.cards.length > 0;
  const allCardsText = order.cards.map((card) => card.content).join("\n");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <WalletCards className="h-5 w-5" />
          卡密信息 ({order.cards.length})
        </CardTitle>
        <CardAction className="flex flex-wrap items-center gap-2">
          {(
            [
              ["sold", "已售出"],
              ["locked", "已锁定"],
              ["available", "可用"],
            ] as const
          ).map(([status, label]) => {
            const count = cardCounts[status];
            if (!count) return null;
            return (
              <Badge key={status} variant="secondary">
                {label} {count}
              </Badge>
            );
          })}
          <CopyTextButton
            text={allCardsText}
            label="复制全部"
            ariaLabel="复制全部卡密"
            disabled={!canCopyAll}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {order.cards.length > 0 ? (
          <>
            <div className="text-xs text-muted-foreground">
              卡密属于敏感信息，复制后请注意粘贴范围与日志留存。
            </div>

            {/* 为什么这样做：移动端表格横向滚动体验较差，使用卡片列表提升可读性；桌面端保留表格便于快速扫描多行信息。 */}
            <div className="space-y-3 md:hidden">
              {order.cards.map((card) => {
                const meta = cardStatusMeta[card.status];
                return (
                  <div key={card.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge className={meta.className}>{meta.label}</Badge>
                      <div className="text-xs text-muted-foreground">
                        <span className="mr-2">锁定</span>
                        <LocalTime value={card.lockedAt} mode="short" />
                      </div>
                    </div>
                    <div className="mt-2 flex items-start gap-2">
                      <code className="flex-1 break-all font-mono text-xs">
                        {card.content}
                      </code>
                      <CopyIconButton text={card.content} ariaLabel="复制卡密" />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                      <div>
                        <div className="text-[11px]">锁定时间</div>
                        <div className="text-foreground">
                          <LocalTime value={card.lockedAt} mode="short" />
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px]">售出时间</div>
                        <div className="text-foreground">
                          <LocalTime value={card.soldAt} mode="short" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden rounded-lg border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">状态</TableHead>
                    <TableHead>卡密</TableHead>
                    <TableHead className="w-[160px]">锁定时间</TableHead>
                    <TableHead className="w-[160px]">售出时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.cards.map((card) => {
                    const meta = cardStatusMeta[card.status];
                    return (
                      <TableRow key={card.id} className="group">
                        <TableCell>
                          <Badge className={meta.className}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <div className="flex items-start gap-2">
                            <code
                              className="min-w-0 flex-1 break-all font-mono text-xs"
                              title={card.content}
                            >
                              {card.content}
                            </code>
                            <CopyIconButton
                              text={card.content}
                              ariaLabel="复制卡密"
                              className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <LocalTime value={card.lockedAt} mode="short" />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <LocalTime value={card.soldAt} mode="short" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
            暂无卡密记录
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UserInfoCard({ order }: { order: OrderDetailData }) {
  const isGuestOrder = Boolean(order.email && !order.userId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-5 w-5" />
          用户信息
        </CardTitle>
        {isGuestOrder ? (
          <CardAction>
            <Badge variant="secondary">游客下单</Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <Field label="用户名">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate" title={order.username ?? ""}>
              {order.username ?? "—"}
            </span>
            {order.username ? (
              <CopyIconButton
                text={order.username}
                ariaLabel="复制用户名"
                className="opacity-80 hover:opacity-100"
              />
            ) : null}
          </div>
        </Field>
        <Field label="用户 ID">
          <div className="flex min-w-0 items-center gap-2">
            <code
              className="min-w-0 flex-1 truncate font-mono text-xs"
              title={order.userId ?? ""}
            >
              {order.userId ?? "—"}
            </code>
            {order.userId ? (
              <CopyIconButton
                text={order.userId}
                ariaLabel="复制用户 ID"
                className="opacity-80 hover:opacity-100"
              />
            ) : null}
          </div>
        </Field>
        <Field label="邮箱（游客下单）" className="sm:col-span-2 lg:col-span-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate" title={order.email ?? ""}>
              {order.email ?? "—"}
            </span>
            {order.email ? (
              <CopyIconButton
                text={order.email}
                ariaLabel="复制邮箱"
                className="opacity-80 hover:opacity-100"
              />
            ) : null}
          </div>
        </Field>
      </CardContent>
    </Card>
  );
}

function TimeInfoCard({ order }: { order: OrderDetailData }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">时间信息</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <Field label="创建时间">
          <LocalTime value={order.createdAt} />
        </Field>
        <Field label="支付时间">
          <LocalTime value={order.paidAt} />
        </Field>
        <Field label="过期时间">
          <LocalTime value={order.expiredAt} />
        </Field>
        <Field label="更新时间">
          <LocalTime value={order.updatedAt} />
        </Field>
        <Field label="申请退款时间">
          <LocalTime value={order.refundRequestedAt} />
        </Field>
        <Field label="退款完成时间">
          <LocalTime value={order.refundedAt} />
        </Field>
        <Field label="退款尝试时间">
          <LocalTime value={order.refundAttemptedAt} />
        </Field>
        <Field label="支付人工核对时间">
          <LocalTime value={order.paymentReviewAt} />
        </Field>
      </CardContent>
    </Card>
  );
}

function OrderErrorState({ message }: { message: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="icon">
          <Link href="/admin/orders" aria-label="返回订单列表">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            订单详情
          </h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}

export function OrderDetailView({ result }: { result: AdminOrderDetailResult }) {
  if (!result.success || !result.data) {
    return <OrderErrorState message={result.message} />;
  }

  const order = result.data;
  const cardCounts = order.cards.reduce<Record<CardStatus, number>>(
    (acc, card) => {
      acc[card.status] += 1;
      return acc;
    },
    { available: 0, locked: 0, sold: 0, refunded: 0 }
  );

  return (
    <div className="space-y-6">
      <OrderHeader order={order} />
      <OrderSummary order={order} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <OrderInfoCard order={order} />
          <OrderNotesCard order={order} />
          <OrderCardsCard order={order} cardCounts={cardCounts} />
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <UserInfoCard order={order} />
          <TimeInfoCard order={order} />
        </div>
      </div>
    </div>
  );
}
