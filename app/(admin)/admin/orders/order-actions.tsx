"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, CheckCircle2, Eye, Copy, RotateCcw, XCircle, Loader2, Trash2 } from "lucide-react";
import { adminCompleteOrder, approveRefund, rejectRefund } from "@/lib/actions/orders";
import { deleteAdminOrders } from "@/lib/actions/admin-orders";
import { toast } from "sonner";

interface OrderActionsProps {
  orderId: string;
  orderNo: string;
  status: string;
  refundReason?: string | null;
  refundEnabled?: boolean;
}

export function OrderActions({ orderId, orderNo, status, refundReason, refundEnabled = false }: OrderActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const handleComplete = () => {
    if (!confirm("确定要手动完成此订单吗？此操作将发放卡密。")) {
      return;
    }

    startTransition(async () => {
      const result = await adminCompleteOrder(orderId, "管理员手动完成");
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleApproveRefund = () => {
    startTransition(async () => {
      const result = await approveRefund(orderId);
      if (result.success) {
        toast.success("退款成功");
        setRefundDialogOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleRejectRefund = () => {
    startTransition(async () => {
      const result = await rejectRefund(orderId, rejectReason || "管理员拒绝退款");
      if (result.success) {
        toast.success(result.message);
        setRejectDialogOpen(false);
        setRejectReason("");
      } else {
        toast.error(result.message);
      }
    });
  };

  const copyOrderNo = () => {
    navigator.clipboard.writeText(orderNo);
    toast.success("订单号已复制");
  };

  const handleDelete = () => {
    // 为什么这样做：删除后需要刷新 Server Component 的订单列表，避免页面仍展示已删除的数据
    startTransition(async () => {
      const result = await deleteAdminOrders([orderId]);
      if (result.success) {
        toast.success(result.message);
        setDeleteDialogOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isPending}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
	        <DropdownMenuContent align="end">
	          <DropdownMenuItem onClick={copyOrderNo}>
	            <Copy className="mr-2 h-4 w-4" />
	            复制订单号
	          </DropdownMenuItem>
	          <DropdownMenuItem asChild>
	            <Link href={`/admin/orders/${orderId}`}>
	              <Eye className="mr-2 h-4 w-4" />
	              查看详情
	            </Link>
	          </DropdownMenuItem>
	          {(status === "pending" || status === "paid") && (
	            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleComplete}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                手动完成
              </DropdownMenuItem>
            </>
          )}
          {status === "refund_pending" && refundEnabled && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setRefundDialogOpen(true)}
                className="text-green-600"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                通过退款
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setRejectDialogOpen(true)}
                className="text-red-600"
              >
                <XCircle className="mr-2 h-4 w-4" />
                拒绝退款
              </DropdownMenuItem>
            </>
          )}
          {status === "refund_pending" && !refundEnabled && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="text-muted-foreground">
                <RotateCcw className="mr-2 h-4 w-4" />
                退款功能未启用
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteDialogOpen(true)}
            className="text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除订单
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 通过退款确认对话框 */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              确认通过退款
            </DialogTitle>
            <DialogDescription>
              通过后将由服务端调用支付平台退款接口，退还用户积分
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium mb-1">退款原因：</p>
              <p className="text-muted-foreground">{refundReason || "未填写"}</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRefundDialogOpen(false)}
              disabled={isPending}
            >
              取消
            </Button>
            <Button
              onClick={handleApproveRefund}
              disabled={isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              确认退款
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 拒绝退款对话框 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>拒绝退款申请</DialogTitle>
            <DialogDescription>
              请填写拒绝原因（可选）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium mb-1">用户退款原因：</p>
              <p className="text-muted-foreground">{refundReason || "未填写"}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reject-reason">拒绝原因</Label>
              <Textarea
                id="reject-reason"
                placeholder="请填写拒绝原因（可选）"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={isPending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectRefund}
              disabled={isPending}
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              确认拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除订单确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除订单</DialogTitle>
            <DialogDescription>
              将删除订单 <span className="font-mono">{orderNo}</span>。该操作不可恢复，请确认后继续。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isPending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
