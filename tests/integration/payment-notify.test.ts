import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { withEnv } from "@/tests/utils";

const dbMocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  updateSets: [] as Array<Record<string, unknown>>,
}));

// 关键：route handler 会读取 lib/db，从而触发 DATABASE_URL 校验；测试必须 mock 掉
vi.mock("@/lib/db", () => ({
  db: {
    query: {
      orders: {
        findFirst: (...args: unknown[]) => dbMocks.findFirst(...args),
      },
    },
    update: (...args: unknown[]) => dbMocks.update(...args),
  },
  orders: {
    // 仅用于构建 where 条件（本测试不关心真实 column 对象）
    orderNo: {},
    id: {},
  },
}));

// 关键：避免 drizzle-orm eq 依赖真实 schema column 结构
vi.mock("drizzle-orm", () => ({
  eq: (...args: unknown[]) => ({ type: "eq", args }),
}));

const actionMocks = vi.hoisted(() => ({
  handlePaymentSuccess: vi.fn(),
}));

vi.mock("@/lib/actions/orders", () => ({
  handlePaymentSuccess: (...args: unknown[]) => actionMocks.handlePaymentSuccess(...args),
}));

const loggerMocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({
      info: (...args: unknown[]) => loggerMocks.info(...args),
      warn: (...args: unknown[]) => loggerMocks.warn(...args),
      error: (...args: unknown[]) => loggerMocks.error(...args),
    }),
  },
}));

import { GET } from "@/app/api/payment/notify/route";

type NotifyBase = {
  pid: string;
  trade_no: string;
  out_trade_no: string;
  type: string;
  name: string;
  money: string;
  trade_status: string;
};

function md5(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex");
}

function computeNotifySign(input: NotifyBase, secret: string): string {
  const payload = Object.entries(input)
    .filter(([, v]) => v !== undefined && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  // 为什么复刻签名计算：这里的测试目标是“route 端到端验签分支”，
  // 不 mock verifySign，能更真实地覆盖参数拼接/排序等边界。
  return md5(payload + secret);
}

function makeRequest(params: Record<string, string>, headers?: Record<string, string>) {
  const url = new URL("https://store.example.com/api/payment/notify");
  url.search = new URLSearchParams(params).toString();

  return {
    nextUrl: url,
    headers: new Headers(headers),
  } as unknown as import("next/server").NextRequest;
}

function makeSignedQuery(input: NotifyBase, secret: string): Record<string, string> {
  const sign = computeNotifySign(input, secret);
  return {
    ...input,
    sign_type: "MD5",
    sign,
  };
}

beforeEach(() => {
  dbMocks.findFirst.mockReset();
  dbMocks.update.mockReset();
  dbMocks.updateSets.length = 0;
  dbMocks.update.mockImplementation(() => ({
    set: (value: Record<string, unknown>) => {
      dbMocks.updateSets.push(value);
      return { where: vi.fn().mockResolvedValue(undefined) };
    },
  }));
  actionMocks.handlePaymentSuccess.mockReset();
  loggerMocks.info.mockReset();
  loggerMocks.warn.mockReset();
  loggerMocks.error.mockReset();
});

describe("/api/payment/notify", () => {
  it("应拒绝缺少必要参数的请求", async () => {
    await withEnv(
      { LDC_CLIENT_ID: "1001", LDC_CLIENT_SECRET: "secret" },
      async () => {
        const response = await GET(
          makeRequest({
            pid: "1001",
            trade_no: "TRADE_1",
            out_trade_no: "ORDER_1",
            money: "10.00",
            // 缺少 sign
          })
        );

        expect(response.status).toBe(400);
        expect(await response.text()).toBe("fail");
      }
    );
  });

  it("应拒绝 pid 不匹配的请求", async () => {
    await withEnv(
      { LDC_CLIENT_ID: "1001", LDC_CLIENT_SECRET: "secret" },
      async () => {
        const base: NotifyBase = {
          pid: "9999",
          trade_no: "TRADE_1",
          out_trade_no: "ORDER_1",
          type: "epay",
          name: "Test",
          money: "10.00",
          trade_status: "TRADE_SUCCESS",
        };

        const response = await GET(makeRequest(makeSignedQuery(base, "secret")));

        expect(response.status).toBe(400);
        expect(await response.text()).toBe("fail");
      }
    );
  });

  it("应拒绝签名不正确的请求", async () => {
    await withEnv(
      { LDC_CLIENT_ID: "1001", LDC_CLIENT_SECRET: "secret" },
      async () => {
        const base: NotifyBase = {
          pid: "1001",
          trade_no: "TRADE_1",
          out_trade_no: "ORDER_1",
          type: "epay",
          name: "Test",
          money: "10.00",
          trade_status: "TRADE_SUCCESS",
        };

        const response = await GET(
          makeRequest({
            ...base,
            sign_type: "MD5",
            sign: "bad-sign",
          })
        );

        expect(response.status).toBe(400);
        expect(await response.text()).toBe("fail");
        expect(dbMocks.findFirst).not.toHaveBeenCalled();
      }
    );
  });

  it("应拒绝金额不匹配的请求", async () => {
    await withEnv(
      { LDC_CLIENT_ID: "1001", LDC_CLIENT_SECRET: "secret" },
      async () => {
        dbMocks.findFirst.mockResolvedValueOnce({
          id: "o1",
          status: "pending",
          totalAmount: "10.00",
          paymentMethod: "ldc",
          tradeNo: null,
        });

        const base: NotifyBase = {
          pid: "1001",
          trade_no: "TRADE_1",
          out_trade_no: "ORDER_1",
          type: "epay",
          name: "Test",
          money: "10.01",
          trade_status: "TRADE_SUCCESS",
        };

        const response = await GET(makeRequest(makeSignedQuery(base, "secret")));

        expect(response.status).toBe(400);
        expect(await response.text()).toBe("fail");
        expect(actionMocks.handlePaymentSuccess).not.toHaveBeenCalled();
      }
    );
  });

  it("应在查库前拒绝非法金额格式", async () => {
    await withEnv(
      { LDC_CLIENT_ID: "1001", LDC_CLIENT_SECRET: "secret" },
      async () => {
        const base: NotifyBase = {
          pid: "1001",
          trade_no: "TRADE_1",
          out_trade_no: "ORDER_1",
          type: "epay",
          name: "Test",
          money: "1e1",
          trade_status: "TRADE_SUCCESS",
        };

        const response = await GET(makeRequest(makeSignedQuery(base, "secret")));

        expect(response.status).toBe(400);
        expect(await response.text()).toBe("fail");
        expect(dbMocks.findFirst).not.toHaveBeenCalled();
      }
    );
  });

  it("应对重复回调保持幂等（已 paid/completed 直接 success）", async () => {
    await withEnv(
      { LDC_CLIENT_ID: "1001", LDC_CLIENT_SECRET: "secret" },
      async () => {
        dbMocks.findFirst.mockResolvedValueOnce({
          id: "o1",
          status: "completed",
          totalAmount: "10.00",
          paymentMethod: "ldc",
          tradeNo: "TRADE_1",
        });

        const base: NotifyBase = {
          pid: "1001",
          trade_no: "TRADE_1",
          out_trade_no: "ORDER_1",
          type: "epay",
          name: "Test",
          money: "10.00",
          trade_status: "TRADE_SUCCESS",
        };

        const response = await GET(makeRequest(makeSignedQuery(base, "secret")));

        expect(response.status).toBe(200);
        expect(await response.text()).toBe("success");
        expect(actionMocks.handlePaymentSuccess).not.toHaveBeenCalled();
      }
    );
  });

  it("trade_status 非成功时应拒绝且不处理订单", async () => {
    await withEnv(
      { LDC_CLIENT_ID: "1001", LDC_CLIENT_SECRET: "secret" },
      async () => {
        dbMocks.findFirst.mockResolvedValueOnce({
          id: "o1",
          status: "pending",
          totalAmount: "10.00",
          paymentMethod: "ldc",
          tradeNo: null,
        });

        const base: NotifyBase = {
          pid: "1001",
          trade_no: "TRADE_1",
          out_trade_no: "ORDER_1",
          type: "epay",
          name: "Test",
          money: "10.00",
          trade_status: "TRADE_FAILED",
        };

        const response = await GET(makeRequest(makeSignedQuery(base, "secret")));

        expect(response.status).toBe(400);
        expect(await response.text()).toBe("fail");
        expect(actionMocks.handlePaymentSuccess).not.toHaveBeenCalled();
      }
    );
  });

  it("已完成订单的 trade_no 不一致时应拒绝重复回调", async () => {
    await withEnv(
      { LDC_CLIENT_ID: "1001", LDC_CLIENT_SECRET: "secret" },
      async () => {
        dbMocks.findFirst.mockResolvedValueOnce({
          id: "o1",
          status: "completed",
          totalAmount: "10.00",
          paymentMethod: "ldc",
          tradeNo: "TRADE_EXISTING",
        });

        const base: NotifyBase = {
          pid: "1001",
          trade_no: "TRADE_OTHER",
          out_trade_no: "ORDER_1",
          type: "epay",
          name: "Test",
          money: "10.00",
          trade_status: "TRADE_SUCCESS",
        };

        const response = await GET(makeRequest(makeSignedQuery(base, "secret")));

        expect(response.status).toBe(409);
        expect(await response.text()).toBe("fail");
        expect(actionMocks.handlePaymentSuccess).not.toHaveBeenCalled();
      }
    );
  });

  it("过期订单收到成功通知时应返回 fail 并记录错误", async () => {
    await withEnv(
      { LDC_CLIENT_ID: "1001", LDC_CLIENT_SECRET: "secret" },
      async () => {
        dbMocks.findFirst.mockResolvedValueOnce({
          id: "o1",
          status: "expired",
          totalAmount: "10.00",
          paymentMethod: "ldc",
          tradeNo: null,
        });

        const base: NotifyBase = {
          pid: "1001",
          trade_no: "TRADE_1",
          out_trade_no: "ORDER_1",
          type: "epay",
          name: "Test",
          money: "10.00",
          trade_status: "TRADE_SUCCESS",
        };

        const response = await GET(makeRequest(makeSignedQuery(base, "secret")));

        expect(response.status).toBe(409);
        expect(await response.text()).toBe("fail");
        expect(loggerMocks.error).toHaveBeenCalled();
        expect(dbMocks.updateSets).toEqual([
          expect.objectContaining({
            paymentReviewReason: "late_payment:expired",
            paymentReviewTradeNo: "TRADE_1",
            paymentReviewAt: expect.any(Date),
          }),
        ]);
        expect(actionMocks.handlePaymentSuccess).not.toHaveBeenCalled();
      }
    );
  });

  it("TRADE_SUCCESS 且订单可处理时应调用 handlePaymentSuccess 并返回 success", async () => {
    await withEnv(
      { LDC_CLIENT_ID: "1001", LDC_CLIENT_SECRET: "secret" },
      async () => {
        dbMocks.findFirst.mockResolvedValueOnce({
          id: "o1",
          status: "pending",
          totalAmount: "10.00",
          paymentMethod: "ldc",
          tradeNo: null,
        });

        actionMocks.handlePaymentSuccess.mockResolvedValueOnce(true);

        const base: NotifyBase = {
          pid: "1001",
          trade_no: "TRADE_1",
          out_trade_no: "ORDER_1",
          type: "epay",
          name: "Test",
          money: "10.00",
          trade_status: "TRADE_SUCCESS",
        };

        const response = await GET(makeRequest(makeSignedQuery(base, "secret")));

        expect(response.status).toBe(200);
        expect(await response.text()).toBe("success");
        expect(actionMocks.handlePaymentSuccess).toHaveBeenCalledWith("ORDER_1", "TRADE_1");
      }
    );
  });
});
