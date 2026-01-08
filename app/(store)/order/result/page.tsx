"use client";

import { useEffect, useState, useCallback, useRef, use, type ReactNode } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getOrderByNo } from "@/lib/actions/orders";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Home,
  Copy,
  Package,
  ReceiptText,
  RefreshCw,
  XCircle,
  ShoppingBag,
} from "lucide-react";
import { formatLocalTime } from "@/lib/time";
import { cn } from "@/lib/utils";

interface OrderResultPageProps {
  // Next 在不同渲染路径下可能传 Promise 或已解析对象；这里兼容两者，
  // 避免在测试/边缘运行时因为形态差异导致页面不可用。
  searchParams: Promise<{ out_trade_no?: string }> | { out_trade_no?: string };
}

interface OrderData {
  orderNo: string;
  productName: string;
  quantity: number;
  totalAmount: string;
  status: string;
  createdAt: Date;
  paidAt: Date | null;
  cards: string[];
}

// 轮询配置
const POLL_INTERVAL = 2000; // 每 2 秒轮询一次
const MAX_POLL_COUNT = 15; // 最多轮询 15 次（共 30 秒）

function isThenable<T>(value: unknown): value is PromiseLike<T> {
  return typeof (value as { then?: unknown } | null)?.then === "function";
}

function CenteredStateCard({
  icon,
  title,
  description,
  actions,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:py-12">
      <Card className="overflow-hidden">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            {icon}
          </div>
          <div className="space-y-1">
            <div className="text-lg font-semibold">{title}</div>
            {description ? (
              <div className="text-sm text-muted-foreground">{description}</div>
            ) : null}
          </div>
          {actions ? <div className="pt-2">{actions}</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoItem({
  label,
  value,
  valueClassName,
  action,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="pt-0.5 text-[11px] font-medium text-muted-foreground">
        {label}
      </div>
      <div className="flex min-w-0 items-center justify-end gap-2">
        <div className={cn("min-w-0 text-right text-sm text-foreground", valueClassName)}>
          {value}
        </div>
        {action}
      </div>
    </div>
  );
}

export default function OrderResultPage({ searchParams }: OrderResultPageProps) {
  const params = isThenable<{ out_trade_no?: string }>(searchParams) ? use(searchParams) : searchParams;
  const { data: session, status: sessionStatus } = useSession();
  const [orderNo, setOrderNo] = useState(params.out_trade_no || "");

  const [order, setOrder] = useState<OrderData | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isOrderNoCopied, setIsOrderNoCopied] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // 轮询计数器
  const pollCountRef = useRef(0);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 检查是否是 Linux DO 登录用户
  const user = session?.user as { provider?: string } | undefined;
  const isLoggedIn = user?.provider === "linux-do";

  // 如果 URL 没有订单号参数，尝试从 localStorage 读取
  useEffect(() => {
    if (!params.out_trade_no) {
      const savedOrderNo = localStorage.getItem("ldc_last_order_no");
      if (savedOrderNo) {
        setOrderNo(savedOrderNo);
        localStorage.removeItem("ldc_last_order_no");
      }
    }
  }, [params.out_trade_no]);

  // 清理轮询定时器
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  const loadOrder = useCallback(async (isPollingRequest = false) => {
    if (!orderNo) {
      setIsLoading(false);
      return;
    }

    try {
      const result = await getOrderByNo(orderNo);
      if (result.success && result.data) {
        const orderData = result.data as OrderData;
        setOrder(orderData);
        
        // 如果订单状态是 pending 且未超过最大轮询次数，继续轮询
        if (orderData.status === "pending" && pollCountRef.current < MAX_POLL_COUNT) {
          setIsPolling(true);
          pollCountRef.current++;
          pollTimerRef.current = setTimeout(() => {
            loadOrder(true);
          }, POLL_INTERVAL);
        } else {
          setIsPolling(false);
          // 如果订单状态已更新，显示提示
          if (isPollingRequest && (orderData.status === "paid" || orderData.status === "completed")) {
            toast.success("支付成功！");
          }
        }
      } else {
        setError(result.message || "获取订单失败");
        setIsPolling(false);
      }
    } catch {
      setError("获取订单失败");
      setIsPolling(false);
    } finally {
      setIsLoading(false);
    }
  }, [orderNo]);

  // 加载订单数据
  useEffect(() => {
    if (sessionStatus === "loading") return;
    
    if (!orderNo) {
      setIsLoading(false);
      return;
    }

    if (!isLoggedIn) {
      setError("请先登录查看订单");
      setIsLoading(false);
      return;
    }

    // 重置轮询计数器
    pollCountRef.current = 0;
    loadOrder();
  }, [sessionStatus, orderNo, isLoggedIn, loadOrder]);

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      toast.success("已复制");
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      toast.error("复制失败");
    }
  };

  // 加载中
  if (isLoading || sessionStatus === "loading") {
    return (
      <CenteredStateCard
        icon={<Loader2 className="h-6 w-6 animate-spin" />}
        title="加载中..."
        description="正在获取订单信息"
      />
    );
  }

  // 未登录
  if (!isLoggedIn) {
    return (
      <CenteredStateCard
        icon={<XCircle className="h-6 w-6" />}
        title="请先登录"
        description="登录后才能查看订单与卡密信息"
        actions={
          <Button asChild>
            <Link href="/">返回首页</Link>
          </Button>
        }
      />
    );
  }

  // 订单号无效
  if (!orderNo) {
    return (
      <CenteredStateCard
        icon={<XCircle className="h-6 w-6" />}
        title="订单号无效"
        description="请从支付页面返回，或在“我的订单”中查看历史订单"
        actions={
          <div className="flex justify-center gap-3">
            <Button asChild variant="outline">
              <Link href="/order/my">我的订单</Link>
            </Button>
            <Button asChild>
              <Link href="/">返回首页</Link>
            </Button>
          </div>
        }
      />
    );
  }

  // 订单不存在或无权限
  if (error) {
    return (
      <CenteredStateCard
        icon={<XCircle className="h-6 w-6" />}
        title="无法获取订单"
        description={error}
        actions={
          <div className="flex justify-center gap-3">
            <Button asChild variant="outline">
              <Link href="/order/my">
                <ShoppingBag className="mr-2 h-4 w-4" />
                我的订单
              </Link>
            </Button>
            <Button asChild>
              <Link href="/">返回首页</Link>
            </Button>
          </div>
        }
      />
    );
  }

  // 加载订单中
  if (!order) {
    return (
      <CenteredStateCard
        icon={<Loader2 className="h-6 w-6 animate-spin" />}
        title="加载订单中..."
      />
    );
  }

  // 已查询 - 显示订单详情
  const isPaid = order.status === "paid" || order.status === "completed";
  const canShowReceipt = isPaid;
  const hasCards = Boolean(order.cards && order.cards.length > 0);

  const statusMeta = (() => {
    if (isPaid) {
      return {
        label: order.status === "completed" ? "已完成" : "已支付",
        title: "支付成功",
        description: hasCards ? "卡密已发放，请及时保存" : "订单已支付，卡密发放中…",
        icon: <CheckCircle2 className="h-5 w-5" />,
        iconClassName:
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        badgeClassName:
          "bg-emerald-600 text-white hover:bg-emerald-600/90",
      };
    }

    switch (order.status) {
      case "pending":
        return {
          label: "待支付",
          title: isPolling ? "正在确认支付状态" : "等待支付完成",
          description: isPolling
            ? "通常会在 30 秒内自动更新，请稍候…"
            : "如果你已完成支付，可点击刷新或稍后查看“我的订单”。",
          icon: isPolling ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Clock className="h-5 w-5" />
          ),
          iconClassName:
            "bg-amber-500/10 text-amber-700 dark:text-amber-300",
          badgeClassName:
            "bg-amber-500 text-white hover:bg-amber-500/90",
        };
      case "expired":
        return {
          label: "已过期",
          title: "订单已过期",
          description: "该订单未在有效期内完成支付。",
          icon: <XCircle className="h-5 w-5" />,
          iconClassName: "bg-muted text-muted-foreground",
          badgeClassName: "bg-muted text-muted-foreground hover:bg-muted",
        };
      case "refund_pending":
        return {
          label: "退款审核中",
          title: "退款处理中",
          description: "你的退款申请已提交，正在等待审核。",
          icon: <Clock className="h-5 w-5" />,
          iconClassName:
            "bg-amber-500/10 text-amber-700 dark:text-amber-300",
          badgeClassName:
            "bg-amber-500 text-white hover:bg-amber-500/90",
        };
      case "refund_rejected":
        return {
          label: "退款已拒绝",
          title: "退款已拒绝",
          description: "如有疑问，请联系管理员或查看订单备注。",
          icon: <XCircle className="h-5 w-5" />,
          iconClassName: "bg-muted text-muted-foreground",
          badgeClassName: "bg-muted text-muted-foreground hover:bg-muted",
        };
      case "refunded":
        return {
          label: "已退款",
          title: "订单已退款",
          description: "该订单已完成退款。",
          icon: <XCircle className="h-5 w-5" />,
          iconClassName: "bg-muted text-muted-foreground",
          badgeClassName: "bg-muted text-muted-foreground hover:bg-muted",
        };
      default:
        return {
          label: order.status,
          title: "订单状态更新中",
          description: "请稍后刷新或前往“我的订单”查看最新状态。",
          icon: <Clock className="h-5 w-5" />,
          iconClassName: "bg-muted text-muted-foreground",
          badgeClassName: "bg-muted text-muted-foreground hover:bg-muted",
        };
    }
  })();

  const copyOrderNo = async () => {
    try {
      await navigator.clipboard.writeText(order.orderNo);
      setIsOrderNoCopied(true);
      toast.success("已复制订单号");
      setTimeout(() => setIsOrderNoCopied(false), 1500);
    } catch {
      toast.error("复制失败");
    }
  };

  const copyAllCards = async () => {
    if (!hasCards) return;
    try {
      await navigator.clipboard.writeText(order.cards.join("\n"));
      toast.success(`已复制 ${order.cards.length} 个卡密`);
    } catch {
      toast.error("复制失败");
    }
  };

  const refreshOrder = async () => {
    setIsRefreshing(true);

    // 为什么这样做：手动刷新通常意味着用户“刚支付完”，这里重置轮询并清理旧定时器，避免并发轮询导致状态闪烁。
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
    }
    pollCountRef.current = 0;

    await loadOrder(true);
    setIsRefreshing(false);
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:py-12">
      <Card className="overflow-hidden">
        <CardContent className="pt-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    statusMeta.iconClassName
                  )}
                >
                  {statusMeta.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold leading-tight">
                      {statusMeta.title}
                    </h1>
                    <Badge className={statusMeta.badgeClassName}>
                      {statusMeta.label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm font-medium text-foreground truncate">
                    {order.productName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {statusMeta.description}
                  </p>
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={refreshOrder}
              disabled={isRefreshing}
              aria-label="刷新订单状态"
              title="刷新订单状态"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing ? "animate-spin" : "")} />
            </Button>
          </div>

          {/* Order Info */}
          <div className="rounded-2xl border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">订单信息</div>
              <div className="text-[11px] text-muted-foreground">
                请妥善保存订单号以便查询
              </div>
            </div>

            <div className="space-y-2">
              <InfoItem
                label="订单号"
                value={<code className="font-mono text-xs">{order.orderNo}</code>}
                valueClassName="max-w-[220px]"
                action={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={copyOrderNo}
                    aria-label="复制订单号"
                    title="复制订单号"
                  >
                    {isOrderNoCopied ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                }
              />
              <InfoItem
                label="金额"
                value={
                  <span className="font-semibold tabular-nums">
                    {order.totalAmount} LDC
                  </span>
                }
              />
              <InfoItem label="数量" value={`${order.quantity} 件`} />
              <InfoItem label="下单时间" value={formatLocalTime(order.createdAt)} />
              {order.paidAt ? (
                <InfoItem label="支付时间" value={formatLocalTime(order.paidAt)} />
              ) : null}
            </div>
          </div>

          {/* Cards / Secure Notice */}
          {isPaid ? (
            hasCards ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-200">
                    <Package className="h-4 w-4" />
                    卡密信息
                    <Badge variant="secondary" className="ml-1">
                      {order.cards.length}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={copyAllCards}
                    disabled={!hasCards}
                  >
                    <Copy className="mr-2 h-3 w-3" />
                    复制全部
                  </Button>
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  卡密属于敏感信息，复制/截图后请注意粘贴范围与聊天记录留存。
                </div>

                <div className="mt-3 space-y-2">
                  {order.cards.map((card, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white p-3 shadow-sm ring-1 ring-black/5 dark:bg-zinc-900"
                    >
                      <code className="text-xs font-mono break-all flex-1 select-all">
                        {card}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => copyToClipboard(card, index)}
                        aria-label="复制卡密"
                        title="复制卡密"
                      >
                        {copiedIndex === index ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                卡密发放中，请稍后点击右上角刷新，或前往“我的订单”查看。
              </div>
            )
          ) : null}

          {/* Actions */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {canShowReceipt ? (
              <Button asChild className="justify-center">
                <Link href={`/order/receipt/${order.orderNo}`}>
                  <ReceiptText className="mr-2 h-4 w-4" />
                  支付成功凭证
                </Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={refreshOrder}
                disabled={isRefreshing}
                className="justify-center"
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing ? "animate-spin" : "")} />
                刷新状态
              </Button>
            )}
            <Button asChild variant="outline" className="justify-center">
              <Link href="/order/my">
                <ShoppingBag className="mr-2 h-4 w-4" />
                我的订单
              </Link>
            </Button>
            <Button asChild variant="ghost" className="justify-center">
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                返回首页
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
