import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const authMocks = vi.hoisted(() => ({
  useSession: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => authMocks.useSession(),
}));

const actionMocks = vi.hoisted(() => ({
  getOrderByNo: vi.fn(),
}));

vi.mock("@/lib/actions/orders", () => ({
  getOrderByNo: (...args: unknown[]) => actionMocks.getOrderByNo(...args),
}));

const sonnerMock = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("sonner", () => sonnerMock);

import OrderResultPage from "@/app/(store)/order/result/page";

type OrderStatus = "pending" | "paid" | "completed" | "expired" | "refunded";

function makeOrder(status: OrderStatus, cards: string[] = []) {
  return {
    orderNo: "ORDER_1",
    productName: "商品 A",
    quantity: 1,
    totalAmount: "10.00",
    status,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    paidAt: status === "paid" || status === "completed" ? new Date("2026-01-01T00:01:00.000Z") : null,
    cards,
  };
}

function renderPage(outTradeNo: string) {
  return render(
    // 为什么不用 Promise：React use(promise) 在测试环境的 Suspense 时序容易引入 act 相关不稳定；
    // 这里用“非 thenable 对象”绕过 suspend，只验证渲染分支与副作用（getOrderByNo 调用）即可。
    <OrderResultPage searchParams={{ out_trade_no: outTradeNo } as unknown as Promise<{ out_trade_no?: string }>} />
  );
}

beforeEach(() => {
  authMocks.useSession.mockReset();
  actionMocks.getOrderByNo.mockReset();
  sonnerMock.toast.success.mockReset();
  sonnerMock.toast.error.mockReset();
  localStorage.clear();
});

describe("OrderResultPage", () => {
  it("应展示 pending 状态与轮询提示", async () => {
    authMocks.useSession.mockReturnValue({
      data: { user: { provider: "linux-do" } },
      status: "authenticated",
    });

    actionMocks.getOrderByNo.mockResolvedValueOnce({
      success: true,
      data: makeOrder("pending"),
    });

    const { unmount } = renderPage("ORDER_1");

    expect(await screen.findByText("商品 A")).toBeInTheDocument();
    expect(screen.getByText("待支付")).toBeInTheDocument();

    // pending 首次查询会进入轮询态（2s 后再次请求）；测试里只断言提示文案，并在结束时 unmount 清理 timer
    expect(screen.getByText(/正在确认支付状态/)).toBeInTheDocument();
    await waitFor(() => {
      expect(actionMocks.getOrderByNo).toHaveBeenCalledWith("ORDER_1");
    });

    unmount();
  });

  it.each([
    ["paid", "已支付"],
    ["completed", "已完成"],
    ["expired", "已过期"],
    ["refunded", "已退款"],
  ] satisfies Array<[OrderStatus, string]>)("应展示 %s 状态文案", async (status, label) => {
    authMocks.useSession.mockReturnValue({
      data: { user: { provider: "linux-do" } },
      status: "authenticated",
    });

    actionMocks.getOrderByNo.mockResolvedValueOnce({
      success: true,
      data: makeOrder(status, status === "completed" ? ["card-001"] : []),
    });

    const { unmount } = renderPage("ORDER_1");

    expect(await screen.findByText("商品 A")).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();

    if (status === "completed") {
      expect(screen.getByText(/卡密信息/)).toBeInTheDocument();
      expect(screen.getByText("card-001")).toBeInTheDocument();
    }

    unmount();
  });
});
