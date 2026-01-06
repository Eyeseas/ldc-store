import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  createPayment,
  generateSign,
  verifySign,
  type NotifyParams,
} from "@/lib/payment/ldc";
import { withEnv } from "@/tests/utils";

function md5(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex");
}

describe("payment signature", () => {
  it("generateSign should match expected md5", () => {
    const secret = "secret";
    const params = {
      pid: "1001",
      type: "epay",
      out_trade_no: "ORDER_1",
      name: "Test Product",
      money: "9.90",
      notify_url: "https://example.com/api/payment/notify",
      return_url: "https://example.com/order/result?out_trade_no=ORDER_1",
      sign: "should-be-ignored",
      sign_type: "MD5",
      empty: "",
      undefinedValue: undefined,
    } as Record<string, string | undefined>;

    const expected = md5(
      [
        `money=${params.money}`,
        `name=${params.name}`,
        `notify_url=${params.notify_url}`,
        `out_trade_no=${params.out_trade_no}`,
        `pid=${params.pid}`,
        `return_url=${params.return_url}`,
        `type=${params.type}`,
      ].join("&") + secret
    );

    expect(generateSign(params, secret)).toBe(expected);
  });

  it("verifySign should return true for valid signature", () => {
    const secret = "secret";
    const params: NotifyParams = {
      pid: "1001",
      trade_no: "TRADE_1",
      out_trade_no: "ORDER_1",
      type: "epay",
      name: "Test Product",
      money: "9.90",
      trade_status: "TRADE_SUCCESS",
      sign_type: "MD5",
      sign: "",
    };

    const signInput = {
      pid: params.pid,
      trade_no: params.trade_no,
      out_trade_no: params.out_trade_no,
      type: params.type,
      name: params.name,
      money: params.money,
      trade_status: params.trade_status,
    };

    const expectedSign = md5(
      Object.entries(signInput)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("&") + secret
    );

    expect(
      verifySign(
        {
          ...params,
          sign: expectedSign,
        },
        secret
      )
    ).toBe(true);
  });

  it("verifySign should return false for tampered payload", () => {
    const secret = "secret";
    const base: NotifyParams = {
      pid: "1001",
      trade_no: "TRADE_1",
      out_trade_no: "ORDER_1",
      type: "epay",
      name: "Test Product",
      money: "9.90",
      trade_status: "TRADE_SUCCESS",
      sign_type: "MD5",
      sign: "",
    };

    const signInput = {
      pid: base.pid,
      trade_no: base.trade_no,
      out_trade_no: base.out_trade_no,
      type: base.type,
      name: base.name,
      money: base.money,
      trade_status: base.trade_status,
    };
    const validSign = md5(
      Object.entries(signInput)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("&") + secret
    );

    expect(
      verifySign(
        {
          ...base,
          sign: validSign,
          money: "19.90",
        },
        secret
      )
    ).toBe(false);
  });
});

describe("createPayment", () => {
  it("should build form data and sign correctly", async () => {
    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_GATEWAY: "https://pay.example.com/epay",
      },
      async () => {
        const result = createPayment(
          "ORDER_1",
          12.34,
          "Test Product",
          "https://store.example.com"
        );

        expect(result.actionUrl).toBe("https://pay.example.com/epay/pay/submit.php");
        expect(result.params.pid).toBe("1001");
        expect(result.params.out_trade_no).toBe("ORDER_1");
        expect(result.params.money).toBe("12.34");
        expect(result.params.sign_type).toBe("MD5");
        expect(result.params.notify_url).toBe("https://store.example.com/api/payment/notify");
        expect(result.params.return_url).toBe("https://store.example.com/order/result?out_trade_no=ORDER_1");

        // 通过 generateSign 复算签名（函数内部会自动忽略 sign/sign_type）
        const recomputed = generateSign(result.params, "secret");
        expect(result.params.sign).toBe(recomputed);
      }
    );
  });
});
