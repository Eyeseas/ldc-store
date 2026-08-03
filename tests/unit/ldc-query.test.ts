import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withEnv } from "@/tests/utils";
import { queryPaymentOrder } from "@/lib/payment/ldc";

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

describe("queryPaymentOrder", () => {
  it("should query by out_trade_no when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 1,
          msg: "ok",
          trade_no: "TRADE_1",
          out_trade_no: "ORDER_1",
          type: "epay",
          pid: "1001",
          addtime: "2026-01-01 00:00:00",
          endtime: "2026-01-01 00:00:10",
          name: "Test",
          money: "10.00",
          status: 1,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_GATEWAY: "https://pay.example.com/epay",
      },
      async () => {
        const result = await queryPaymentOrder({ outTradeNo: "ORDER_1" });
        expect(result?.trade_no).toBe("TRADE_1");
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const url = new URL(fetchMock.mock.calls[0]?.[0] as string);
        expect(url.origin + url.pathname).toBe("https://pay.example.com/epay/api.php");
        expect(url.searchParams.get("act")).toBe("order");
        expect(url.searchParams.get("pid")).toBe("1001");
        expect(url.searchParams.get("key")).toBe("secret");
        expect(url.searchParams.get("out_trade_no")).toBe("ORDER_1");
      }
    );
  });

  it("should reject undocumented trade_no-only queries", async () => {
    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_GATEWAY: "https://pay.example.com/epay",
      },
      async () => {
        await expect(
          queryPaymentOrder({ tradeNo: "TRADE_1" } as never)
        ).rejects.toThrow(/outTradeNo/);
      }
    );
  });

  it("should return null on 404", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ code: -1, msg: "服务不存在或已完成" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_GATEWAY: "https://pay.example.com/epay",
      },
      async () => {
        const result = await queryPaymentOrder({ outTradeNo: "ORDER_404" });
        expect(result).toBeNull();
      }
    );
  });

  it("should return null when code is -1 (HTTP 200)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ code: -1, msg: "服务不存在或已完成" }), {
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
      },
      async () => {
        const result = await queryPaymentOrder({ outTradeNo: "ORDER_MISSING" });
        expect(result).toBeNull();
      }
    );
  });

  it("should throw for non-JSON response without Cloudflare", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response("gateway says hello", {
        status: 200,
        headers: { "content-type": "text/plain" },
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_GATEWAY: "https://pay.example.com/epay",
      },
      async () => {
        await expect(queryPaymentOrder({ outTradeNo: "ORDER_1" })).rejects.toThrow(
          /返回格式异常/
        );
      }
    );
  });

  it("should throw when JSON parsing fails", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response("not-json", {
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
      },
      async () => {
        await expect(queryPaymentOrder({ outTradeNo: "ORDER_1" })).rejects.toThrow();
      }
    );
  });

  it("should throw when outTradeNo is missing", async () => {
    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_GATEWAY: "https://pay.example.com/epay",
      },
      async () => {
        await expect(queryPaymentOrder({} as never)).rejects.toThrow(/缺少/);
      }
    );
  });

  it("should reject a successful response missing required fields", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 1, msg: "ok", status: 1 }), {
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
      },
      async () => {
        await expect(
          queryPaymentOrder({ outTradeNo: "ORDER_1" })
        ).rejects.toThrow(/响应格式/);
      }
    );
  });

  it("should throw a friendly error when Cloudflare blocks", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response("<html><title>Just a moment...</title>cloudflare</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_GATEWAY: "https://pay.example.com/epay",
      },
      async () => {
        await expect(queryPaymentOrder({ outTradeNo: "ORDER_1" })).rejects.toThrow(
          /Cloudflare/
        );
      }
    );
  });

  it("should throw when code is not 1 and not -1", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ code: -2, msg: "KEY校验失败" }), {
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
      },
      async () => {
        await expect(queryPaymentOrder({ outTradeNo: "ORDER_1" })).rejects.toThrow(
          /KEY校验失败/
        );
      }
    );
  });

  it("should reject a non-HTTPS query proxy", async () => {
    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_PROXY_URL: "http://proxy.example.com/api.php",
      },
      async () => {
        await expect(
          queryPaymentOrder({ outTradeNo: "ORDER_1" })
        ).rejects.toThrow(/HTTPS/);
      }
    );
  });

  it("should convert query timeouts to a clear error", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("timed out", "TimeoutError")) as unknown as typeof fetch;

    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
      },
      async () => {
        await expect(
          queryPaymentOrder({ outTradeNo: "ORDER_1" })
        ).rejects.toThrow(/超时/);
      }
    );
  });
});
