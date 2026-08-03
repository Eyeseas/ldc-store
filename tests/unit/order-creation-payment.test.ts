import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  findProduct: vi.fn(),
  transaction: vi.fn(),
  insertedOrder: null as Record<string, unknown> | null,
}));

const paymentMocks = vi.hoisted(() => ({
  createPayment: vi.fn(),
  getPaymentProtocol: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({ auth: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      products: {
        findFirst: (...args: unknown[]) => dbMocks.findProduct(...args),
      },
    },
    transaction: (...args: unknown[]) => dbMocks.transaction(...args),
  },
  orders: { id: {}, status: {}, expiredAt: {} },
  cards: { id: {}, productId: {}, status: {}, orderId: {} },
  products: { id: {}, isActive: {} },
}));

vi.mock("drizzle-orm", () => ({
  eq: (...args: unknown[]) => ({ type: "eq", args }),
  and: (...args: unknown[]) => ({ type: "and", args }),
  inArray: (...args: unknown[]) => ({ type: "inArray", args }),
  sql: (...args: unknown[]) => ({ type: "sql", args }),
  desc: vi.fn(),
  or: vi.fn(),
  isNull: vi.fn(),
}));

vi.mock("@/lib/payment/ldc", () => ({
  createPayment: (...args: unknown[]) => paymentMocks.createPayment(...args),
  getPaymentProtocol: () => paymentMocks.getPaymentProtocol(),
  queryPaymentOrder: vi.fn(),
  refundOrder: vi.fn(),
  isRefundEnabled: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: () => authMocks.auth() }));
vi.mock("@/lib/auth-utils", () => ({ requireAdmin: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(
    new Headers({ host: "store.example.com", "x-forwarded-proto": "https" })
  ),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/time", () => ({
  getExpireTime: () => new Date("2026-08-03T01:05:00Z"),
}));
vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    info: vi.fn(),
    error: vi.fn(),
  },
  getRequestIdFromHeaders: vi.fn().mockResolvedValue("req-1"),
}));
vi.mock("@/lib/actions/system-settings", () => ({
  getSystemSettings: vi.fn().mockResolvedValue({ orderExpireMinutes: 5 }),
  getTelegramConfigWithToggles: vi.fn(),
}));
vi.mock("@/lib/notifications/telegram", () => ({
  sendNewOrderNotification: vi.fn(),
  sendPaymentSuccessNotification: vi.fn(),
  sendRefundRequestNotification: vi.fn(),
  sendRefundApprovedNotification: vi.fn(),
  sendRefundRejectedNotification: vi.fn(),
}));

import { createOrder } from "@/lib/actions/orders";

beforeEach(() => {
  dbMocks.findProduct.mockReset();
  dbMocks.transaction.mockReset();
  dbMocks.insertedOrder = null;
  paymentMocks.createPayment.mockReset();
  paymentMocks.getPaymentProtocol.mockReset();
  authMocks.auth.mockReset();
});

describe("createOrder payment protocol", () => {
  it("应以整数分计算总价并保存实际支付协议", async () => {
    authMocks.auth.mockResolvedValue({
      user: {
        id: "u1",
        provider: "linux-do",
        username: "tester",
        image: null,
      },
    });
    paymentMocks.getPaymentProtocol.mockReturnValue("ldcpay");
    paymentMocks.createPayment.mockReturnValue({
      actionUrl: "https://pay.example.com/epay/pay/submit.php",
      params: {},
    });
    dbMocks.findProduct.mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Test Product",
      slug: "test-product",
      price: "0.10",
      minQuantity: 1,
      maxQuantity: 10,
      isActive: true,
    });

    const releaseTx = {
      update: () => ({
        set: () => ({
          where: () => ({ returning: vi.fn().mockResolvedValue([]) }),
        }),
      }),
    };
    const createTx = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => ({
              for: vi.fn().mockResolvedValue([
                { id: "c1" },
                { id: "c2" },
                { id: "c3" },
              ]),
            }),
          }),
        }),
      }),
      insert: () => ({
        values: (value: Record<string, unknown>) => {
          dbMocks.insertedOrder = value;
          return {
            returning: vi.fn().mockResolvedValue([
              {
                id: "o1",
                orderNo: "ORDER_1",
                createdAt: new Date("2026-08-03T01:00:00Z"),
                expiredAt: new Date("2026-08-03T01:05:00Z"),
              },
            ]),
          };
        },
      }),
      update: () => ({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) }),
    };
    dbMocks.transaction
      .mockImplementationOnce(async (callback) => callback(releaseTx))
      .mockImplementationOnce(async (callback) => callback(createTx));

    const result = await createOrder({
      productId: "550e8400-e29b-41d4-a716-446655440000",
      quantity: 3,
      paymentMethod: "ldc",
    });

    expect(result).toMatchObject({ success: true });
    expect(dbMocks.insertedOrder).toEqual(
      expect.objectContaining({
        totalAmount: "0.30",
        paymentProtocol: "ldcpay",
      })
    );
    expect(paymentMocks.createPayment).toHaveBeenCalledWith(
      "ORDER_1",
      "0.30",
      "Test Product",
      "https://store.example.com"
    );
  });
});
