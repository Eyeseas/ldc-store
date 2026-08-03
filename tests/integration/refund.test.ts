import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withEnv } from "@/tests/utils";
import {
  getRefundMode,
  isRefundEnabled,
  refundOrder,
} from "@/lib/payment/ldc";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  (console.log as unknown as { mockRestore: () => void }).mockRestore?.();
  (console.error as unknown as { mockRestore: () => void }).mockRestore?.();
  globalThis.fetch = originalFetch;
});

describe("refund mode", () => {
  it("未配置服务端退款能力时默认禁用退款", async () => {
    await withEnv(
      { LDC_REFUND_MODE: undefined, LDC_PROXY_URL: undefined },
      async () => {
        expect(getRefundMode()).toBe("disabled");
        expect(isRefundEnabled()).toBe(false);
      }
    );
  });

  it("仅配置 LDC_PROXY_URL 不得隐式启用退款", async () => {
    await withEnv({ LDC_PROXY_URL: "https://proxy.example.com/api.php" }, async () => {
      expect(getRefundMode()).toBe("disabled");
      expect(isRefundEnabled()).toBe(false);
    });
  });

  it("proxy 模式必须同时配置代理地址", async () => {
    await withEnv(
      { LDC_REFUND_MODE: "proxy", LDC_PROXY_URL: undefined },
      async () => {
        expect(() => getRefundMode()).toThrow(/LDC_PROXY_URL/);
      }
    );
  });

  it("未知退款模式应直接报配置错误", async () => {
    await withEnv({ LDC_REFUND_MODE: "typo" }, async () => {
      expect(() => getRefundMode()).toThrow(/LDC_REFUND_MODE/);
    });
  });

  it("显式 disabled 应禁用退款", async () => {
    await withEnv({ LDC_REFUND_MODE: "disabled" }, async () => {
      expect(getRefundMode()).toBe("disabled");
      expect(isRefundEnabled()).toBe(false);
    });
  });

  it("显式 server 应启用服务端直连退款", async () => {
    await withEnv(
      { LDC_REFUND_MODE: "server", LDC_PROXY_URL: undefined },
      async () => {
        expect(getRefundMode()).toBe("server");
        expect(isRefundEnabled()).toBe(true);
      }
    );
  });

  it("旧的 client 配置不得重新启用浏览器退款", async () => {
    await withEnv({ LDC_REFUND_MODE: "client" }, async () => {
      expect(getRefundMode()).toBe("disabled");
      expect(isRefundEnabled()).toBe(false);
    });
  });
});

describe("refundOrder", () => {
  it("应在 proxy 模式下请求 LDC_PROXY_URL（并移除尾部斜杠）", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 1, msg: "退款成功" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_PROXY_URL: "https://proxy.example.com/api.php/",
        LDC_REFUND_MODE: "proxy",
      },
      async () => {
        const result = await refundOrder("TRADE_1", "10.00");
        expect(result.code).toBe(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0]?.[0]).toBe("https://proxy.example.com/api.php");
      }
    );
  });

  it("proxy 模式拒绝非 HTTPS 地址", async () => {
    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_PROXY_URL: "http://proxy.example.com/api.php",
        LDC_REFUND_MODE: "proxy",
      },
      async () => {
        await expect(refundOrder("TRADE_1", "10.00")).rejects.toThrow(/HTTPS/);
      }
    );
  });

  it("应使用 x-www-form-urlencoded POST 调用退款接口", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 1, msg: "退款成功" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_GATEWAY: "https://pay.example.com/epay",
        LDC_PROXY_URL: undefined,
        LDC_REFUND_MODE: "server",
      },
      async () => {
        await refundOrder("TRADE_1", "10.00");

        const call = fetchMock.mock.calls[0];
        const url = call?.[0] as string;
        const init = call?.[1] as RequestInit | undefined;

        expect(url).toBe("https://pay.example.com/epay/api.php");
        expect(init?.method).toBe("POST");
        expect(init?.headers).toMatchObject({
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        });

        // 为什么要断言 body：退款的 money 必须与原订单一致，且字段名固定（pid/key/trade_no/money）
        expect(String(init?.body)).toBe("pid=1001&key=secret&trade_no=TRADE_1&money=10.00");
      }
    );
  });

  it("disabled 模式不得发起退款请求", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_REFUND_MODE: "disabled",
        LDC_PROXY_URL: undefined,
      },
      async () => {
        await expect(refundOrder("TRADE_1", "10.00")).rejects.toThrow(/未启用/);
        expect(fetchMock).not.toHaveBeenCalled();
      }
    );
  });

  it("server 模式即使配置代理也应直连官方地址", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 1, msg: "退款成功" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_GATEWAY: "https://pay.example.com/epay",
        LDC_PROXY_URL: "https://proxy.example.com/api.php",
        LDC_REFUND_MODE: "server",
      },
      async () => {
        await refundOrder("TRADE_1", "10.00");
        expect(fetchMock.mock.calls[0]?.[0]).toBe(
          "https://pay.example.com/epay/api.php"
        );
      }
    );
  });

  it("应将退款请求超时转换为明确错误", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("timed out", "TimeoutError")) as unknown as typeof fetch;

    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_REFUND_MODE: "server",
      },
      async () => {
        await expect(refundOrder("TRADE_1", "10.00")).rejects.toThrow(/超时/);
      }
    );
  });

  it("应拒绝结构不完整的退款响应", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    ) as unknown as typeof fetch;

    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_REFUND_MODE: "server",
      },
      async () => {
        await expect(refundOrder("TRADE_1", "10.00")).rejects.toThrow(/响应格式/);
      }
    );
  });

  it("应保留平台明确业务失败结果", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ code: -1, msg: "余额不足" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    ) as unknown as typeof fetch;

    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_REFUND_MODE: "server",
      },
      async () => {
        await expect(refundOrder("TRADE_1", "10.00")).resolves.toEqual({
          code: -1,
          msg: "余额不足",
        });
      }
    );
  });

  it("应在发请求前拒绝非法退款流水号或金额", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_REFUND_MODE: "server",
      },
      async () => {
        await expect(refundOrder("", "10.00")).rejects.toThrow(/流水号/);
        await expect(refundOrder("TRADE_1", "10.0")).rejects.toThrow(/金额/);
        expect(fetchMock).not.toHaveBeenCalled();
      }
    );
  });
});
