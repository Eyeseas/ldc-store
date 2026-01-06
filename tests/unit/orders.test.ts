import { describe, expect, it, vi } from "vitest";

// 关键：避免在单元测试中初始化真实数据库连接（lib/db 会强依赖 DATABASE_URL）
vi.mock("@/lib/db", () => ({
  db: {},
  orders: {},
  cards: {},
  products: {},
}));

const authMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => authMock(),
}));

// 避免测试输出被日志污染（这里不关心日志行为）
vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  getRequestIdFromHeaders: async () => undefined,
}));

import { createOrder } from "@/lib/actions/orders";

describe("createOrder", () => {
  it("should reject when user is not logged in", async () => {
    authMock.mockResolvedValueOnce(null);

    const result = await createOrder({
      productId: "00000000-0000-0000-0000-000000000000",
      quantity: 1,
      paymentMethod: "ldc",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("请先登录");
  });

  it("should validate input before touching database", async () => {
    authMock.mockResolvedValueOnce({
      user: {
        id: "u1",
        provider: "linux-do",
        username: "tester",
      },
    });

    const result = await createOrder({
      productId: "not-a-uuid",
      quantity: 1,
      paymentMethod: "ldc",
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe("无效的商品ID");
  });
});
