import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  rootUpdate: vi.fn(),
  txUpdate: vi.fn(),
  transaction: vi.fn(),
  rootSets: [] as Array<Record<string, unknown>>,
  txSets: [] as Array<Record<string, unknown>>,
  rootReturning: [] as Array<Array<{ id: string }>>,
}));

const paymentMocks = vi.hoisted(() => ({
  refundOrder: vi.fn(),
  isRefundEnabled: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
}));

function makeUpdateMock(
  target: Array<Record<string, unknown>>,
  returningQueue?: Array<Array<{ id: string }>>
) {
  return vi.fn(() => ({
    set: (value: Record<string, unknown>) => {
      target.push(value);
      return {
        where: () => ({
          returning: vi
            .fn()
            .mockResolvedValue(returningQueue?.shift() ?? [{ id: "o1" }]),
        }),
      };
    },
  }));
}

vi.mock("@/lib/db", () => ({
  db: {
    query: { orders: { findFirst: (...args: unknown[]) => dbMocks.findFirst(...args) } },
    update: (...args: unknown[]) => dbMocks.rootUpdate(...args),
    transaction: (...args: unknown[]) => dbMocks.transaction(...args),
  },
  orders: { id: {}, status: {}, orderNo: {}, refundAttemptStatus: {} },
  cards: { orderId: {} },
  products: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: (...args: unknown[]) => ({ type: "eq", args }),
  and: (...args: unknown[]) => ({ type: "and", args }),
  or: (...args: unknown[]) => ({ type: "or", args }),
  isNull: (...args: unknown[]) => ({ type: "isNull", args }),
  sql: vi.fn(),
  desc: vi.fn(),
  inArray: vi.fn(),
}));

vi.mock("@/lib/payment/ldc", () => ({
  createPayment: vi.fn(),
  getPaymentProtocol: vi.fn(),
  queryPaymentOrder: vi.fn(),
  refundOrder: (...args: unknown[]) => paymentMocks.refundOrder(...args),
  isRefundEnabled: () => paymentMocks.isRefundEnabled(),
}));

vi.mock("@/lib/auth-utils", () => ({
  requireAdmin: () => authMocks.requireAdmin(),
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/time", () => ({ getExpireTime: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    error: vi.fn(),
  },
  getRequestIdFromHeaders: vi.fn().mockResolvedValue("req-1"),
}));
vi.mock("@/lib/actions/system-settings", () => ({
  getSystemSettings: vi.fn(),
  getTelegramConfigWithToggles: vi.fn(),
}));
vi.mock("@/lib/notifications/telegram", () => ({
  sendNewOrderNotification: vi.fn(),
  sendPaymentSuccessNotification: vi.fn(),
  sendRefundRequestNotification: vi.fn(),
  sendRefundApprovedNotification: vi.fn(),
  sendRefundRejectedNotification: vi.fn(),
}));

import { approveRefund } from "@/lib/actions/orders";

beforeEach(() => {
  dbMocks.findFirst.mockReset();
  dbMocks.rootSets.length = 0;
  dbMocks.txSets.length = 0;
  dbMocks.rootReturning.length = 0;
  dbMocks.rootUpdate = makeUpdateMock(dbMocks.rootSets, dbMocks.rootReturning);
  dbMocks.txUpdate = makeUpdateMock(dbMocks.txSets);
  dbMocks.transaction.mockReset();
  dbMocks.transaction.mockImplementation(async (callback) =>
    callback({ update: (...args: unknown[]) => dbMocks.txUpdate(...args) })
  );
  paymentMocks.refundOrder.mockReset();
  paymentMocks.isRefundEnabled.mockReset();
  authMocks.requireAdmin.mockReset();
});

describe("approveRefund", () => {
  it("平台退款成功后应在同一事务中更新订单和卡密", async () => {
    paymentMocks.isRefundEnabled.mockReturnValue(true);
    paymentMocks.refundOrder.mockResolvedValue({ code: 1, msg: "退款成功" });
    authMocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
    dbMocks.findFirst.mockResolvedValue({
      id: "o1",
      orderNo: "ORDER_1",
      status: "refund_pending",
      tradeNo: "TRADE_1",
      totalAmount: "10.00",
      productName: "Test",
      quantity: 1,
      paymentMethod: "ldc",
      username: "tester",
      refundAttemptStatus: null,
    });

    const result = await approveRefund("o1", "已核实");

    expect(result.success).toBe(true);
    expect(dbMocks.transaction).toHaveBeenCalledTimes(1);
    expect(dbMocks.txSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "refunded" }),
        expect.objectContaining({ status: "refunded" }),
      ])
    );
  });

  it("订单已退款时重复审批应幂等成功且不再次请求平台", async () => {
    paymentMocks.isRefundEnabled.mockReturnValue(true);
    authMocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
    dbMocks.findFirst.mockResolvedValue({
      id: "o1",
      orderNo: "ORDER_1",
      status: "refunded",
      tradeNo: "TRADE_1",
      totalAmount: "10.00",
      refundAttemptStatus: "succeeded",
    });

    const result = await approveRefund("o1");

    expect(result).toEqual({ success: true, message: "该订单已退款" });
    expect(paymentMocks.refundOrder).not.toHaveBeenCalled();
  });

  it("退款结果不确定时不得自动重试", async () => {
    paymentMocks.isRefundEnabled.mockReturnValue(true);
    authMocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
    dbMocks.findFirst.mockResolvedValue({
      id: "o1",
      orderNo: "ORDER_1",
      status: "refund_pending",
      tradeNo: "TRADE_1",
      totalAmount: "10.00",
      refundAttemptStatus: "uncertain",
    });

    const result = await approveRefund("o1");

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/待人工核对/);
    expect(paymentMocks.refundOrder).not.toHaveBeenCalled();
  });

  it("平台成功但本地事务失败时应记录 uncertain", async () => {
    paymentMocks.isRefundEnabled.mockReturnValue(true);
    paymentMocks.refundOrder.mockResolvedValue({ code: 1, msg: "退款成功" });
    authMocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
    dbMocks.findFirst.mockResolvedValue({
      id: "o1",
      orderNo: "ORDER_1",
      status: "refund_pending",
      tradeNo: "TRADE_1",
      totalAmount: "10.00",
      refundAttemptStatus: null,
    });
    dbMocks.transaction.mockRejectedValueOnce(new Error("database unavailable"));

    const result = await approveRefund("o1");

    expect(result.success).toBe(false);
    expect(dbMocks.rootSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ refundAttemptStatus: "uncertain" }),
      ])
    );
  });
});
