"use client";

import type { RefObject } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LocalTime } from "@/components/time/local-time";

import { deleteAdminOrders, type AdminOrderListItem } from "@/lib/actions/admin-orders";

import { orderStatusConfig, paymentMethodLabels } from "./order-meta";
import { OrderActions } from "./order-actions";
import { buildAdminOrdersExportUrl } from "./orders-url";

function Checkbox({
  checked,
  onChange,
  inputRef,
  ariaLabel,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={ariaLabel}
      disabled={disabled}
      className="h-4 w-4 rounded border-input bg-background accent-primary disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function triggerDownload(url: string) {
  // 为什么这样做：用动态创建 <a> 点击的方式触发下载，避免切换到 /api 页面。
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function useOrdersSelection(items: AdminOrderListItem[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const pageIds = useMemo(() => items.map((i) => i.id), [items]);

  const selection = useMemo(() => {
    const selectedOnPage = pageIds.filter((id) => selectedIds.has(id));
    return {
      selectedCount: selectedIds.size,
      allOnPageSelected:
        pageIds.length > 0 && selectedOnPage.length === pageIds.length,
      someOnPageSelected:
        selectedOnPage.length > 0 && selectedOnPage.length < pageIds.length,
    };
  }, [pageIds, selectedIds]);

  const selectAllRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = selection.someOnPageSelected;
  }, [selection.someOnPageSelected]);

  const toggleAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const id of pageIds) next.add(id);
      } else {
        for (const id of pageIds) next.delete(id);
      }
      return next;
    });
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  return {
    selectedIds,
    selection,
    selectAllRef,
    toggleAllOnPage,
    toggleOne,
    clearSelection,
  };
}

function OrdersBulkActionBar({
  selectedCount,
  isDeleting,
  onDeleteSelected,
  onExportSelected,
  onClearSelection,
}: {
  selectedCount: number;
  isDeleting: boolean;
  onDeleteSelected: () => void;
  onExportSelected: () => void;
  onClearSelection: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        {selectedCount > 0 ? (
          <span>
            已选择 <span className="font-medium text-foreground">{selectedCount}</span>{" "}
            项
          </span>
        ) : (
          <span>可勾选订单进行批量操作</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isDeleting || selectedCount === 0}
          onClick={onExportSelected}
        >
          <Download className="h-4 w-4" />
          导出选中
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={isDeleting || selectedCount === 0}
          onClick={onDeleteSelected}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          删除选中
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isDeleting || selectedCount === 0}
          onClick={onClearSelection}
        >
          清除选择
        </Button>
      </div>
    </div>
  );
}

function OrdersBulkDeleteDialog({
  open,
  onOpenChange,
  selectedCount,
  isDeleting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  isDeleting: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>确认删除订单</DialogTitle>
          <DialogDescription>
            将删除 {selectedCount} 笔订单。该操作不可恢复，请确认后继续。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting}
            onClick={onConfirm}
          >
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrdersTableView({
  items,
  refundEnabled,
  selectedIds,
  selectAllRef,
  allOnPageSelected,
  onToggleAllOnPage,
  onToggleOne,
}: {
  items: AdminOrderListItem[];
  refundEnabled: boolean;
  selectedIds: Set<string>;
  selectAllRef: RefObject<HTMLInputElement | null>;
  allOnPageSelected: boolean;
  onToggleAllOnPage: (checked: boolean) => void;
  onToggleOne: (id: string, checked: boolean) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[36px]">
              <Checkbox
                inputRef={selectAllRef}
                checked={allOnPageSelected}
                onChange={onToggleAllOnPage}
                ariaLabel="全选当前页"
              />
            </TableHead>
            <TableHead>订单号</TableHead>
            <TableHead>商品</TableHead>
            <TableHead className="text-center">数量</TableHead>
            <TableHead className="text-right">金额</TableHead>
            <TableHead>支付方式</TableHead>
            <TableHead className="text-center">状态</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((order) => {
            const meta = orderStatusConfig[order.status];
            return (
              <TableRow key={order.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(order.id)}
                    onChange={(checked) => onToggleOne(order.id, checked)}
                    ariaLabel={`选择订单 ${order.orderNo}`}
                  />
                </TableCell>
                <TableCell className="font-mono text-sm">{order.orderNo}</TableCell>
                <TableCell>
                  <span className="max-w-[200px] truncate block">{order.productName}</span>
                </TableCell>
                <TableCell className="text-center">{order.quantity}</TableCell>
                <TableCell className="text-right font-medium">
                  {order.totalAmount} LDC
                </TableCell>
                <TableCell>
                  {paymentMethodLabels[order.paymentMethod] || order.paymentMethod}
                </TableCell>
                <TableCell className="text-center">
                  <Badge className={meta.color}>{meta.label}</Badge>
                </TableCell>
                <TableCell className="text-sm text-zinc-500">
                  <LocalTime value={order.createdAt} mode="short" />
                </TableCell>
                <TableCell className="text-right">
                  <OrderActions
                    orderId={order.id}
                    orderNo={order.orderNo}
                    status={order.status}
                    refundReason={order.refundReason}
                    refundEnabled={refundEnabled}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function OrdersTable({
  items,
  refundEnabled,
}: {
  items: AdminOrderListItem[];
  refundEnabled: boolean;
}) {
  const router = useRouter();
  const [isDeleting, startDeleting] = useTransition();
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const {
    selectedIds,
    selection,
    selectAllRef,
    toggleAllOnPage,
    toggleOne,
    clearSelection,
  } = useOrdersSelection(items);

  const openBulkDelete = () => {
    if (selection.selectedCount === 0) return;
    setBulkDeleteOpen(true);
  };

  const confirmBulkDelete = () => {
    if (selection.selectedCount === 0) {
      setBulkDeleteOpen(false);
      return;
    }

    startDeleting(async () => {
      const result = await deleteAdminOrders(Array.from(selectedIds));
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setBulkDeleteOpen(false);
      // 为什么这样做：删除会影响服务端列表数据，refresh 触发重新拉取，确保列表/统计即时一致
      clearSelection();
      router.refresh();
    });
  };

  const exportSelected = () => {
    if (selection.selectedCount === 0) return;
    triggerDownload(
      buildAdminOrdersExportUrl({
        ids: Array.from(selectedIds),
      })
    );
  };

  return (
    <div className="space-y-3">
      <OrdersBulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        selectedCount={selection.selectedCount}
        isDeleting={isDeleting}
        onConfirm={confirmBulkDelete}
      />

      <OrdersBulkActionBar
        selectedCount={selection.selectedCount}
        isDeleting={isDeleting}
        onDeleteSelected={openBulkDelete}
        onExportSelected={exportSelected}
        onClearSelection={clearSelection}
      />

      <OrdersTableView
        items={items}
        refundEnabled={refundEnabled}
        selectedIds={selectedIds}
        selectAllRef={selectAllRef}
        allOnPageSelected={selection.allOnPageSelected}
        onToggleAllOnPage={toggleAllOnPage}
        onToggleOne={toggleOne}
      />
    </div>
  );
}
