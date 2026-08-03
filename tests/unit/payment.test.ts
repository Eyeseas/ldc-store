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

  it("verifySign should accept uppercase MD5 and reject malformed signatures", () => {
    const secret = "secret";
    const params: NotifyParams = {
      pid: "1001",
      trade_no: "TRADE_1",
      out_trade_no: "ORDER_1",
      type: "epay",
      name: "Test Product",
      money: "9.90",
      trade_status: "TRADE_SUCCESS",
      sign_type: "",
      sign: "",
    };
    const validSign = generateSign(
      params as unknown as Record<string, string | undefined>,
      secret
    );

    expect(verifySign({ ...params, sign: validSign.toUpperCase() }, secret)).toBe(
      true
    );
    expect(verifySign({ ...params, sign: "not-a-md5" }, secret)).toBe(false);
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
          "12.34",
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

  it("ldcpay 应生成可由已知 Ed25519 公钥验证的原生支付表单", async () => {
    const privateKeyPkcs8Base64 =
      "MC4CAQAwBQYDK2VwBCIEIJ1hsZ3v/VpguoRK9JLsLMREScVpezJpGXA7rAMcrn9g";
    const publicKeySpkiBase64 =
      "MCowBQYDK2VwAyEA11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo=";

    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_GATEWAY: "https://pay.example.com/epay",
        LDC_PAYMENT_PROTOCOL: "ldcpay",
        LDC_ED25519_PRIVATE_KEY_PKCS8_BASE64: privateKeyPkcs8Base64,
      },
      async () => {
        const result = createPayment(
          "ORDER_1",
          "12.34",
          "Test Product",
          "https://store.example.com"
        );

        expect(result.params).toMatchObject({
          client_id: "1001",
          type: "ldcpay",
          out_trade_no: "ORDER_1",
          money: "12.34",
          order_name: "Test Product",
          notify_url: "https://store.example.com/api/payment/notify",
          return_url: "https://store.example.com/order/result?out_trade_no=ORDER_1",
        });
        expect(result.params).not.toHaveProperty("pid");
        expect(result.params).not.toHaveProperty("sign_type");

        const canonical =
          "client_id=1001&money=12.34&notify_url=https://store.example.com/api/payment/notify&order_name=Test Product&out_trade_no=ORDER_1&return_url=https://store.example.com/order/result?out_trade_no=ORDER_1&type=ldcpay";
        const publicKey = crypto.createPublicKey({
          key: Buffer.from(publicKeySpkiBase64, "base64"),
          format: "der",
          type: "spki",
        });

        expect(
          crypto.verify(
            null,
            Buffer.from(canonical + "secret", "utf8"),
            publicKey,
            Buffer.from(result.params.sign, "base64")
          )
        ).toBe(true);
      }
    );
  });

  it("未知支付协议应在生成支付表单前失败", async () => {
    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_PAYMENT_PROTOCOL: "unknown",
      },
      async () => {
        expect(() =>
          createPayment(
            "ORDER_1",
            "12.34",
            "Test Product",
            "https://store.example.com"
          )
        ).toThrow(/LDC_PAYMENT_PROTOCOL/);
      }
    );
  });

  it("支付金额不是规范两位小数字符串时应拒绝", async () => {
    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
      },
      async () => {
        expect(() =>
          createPayment(
            "ORDER_1",
            "12.345",
            "Test Product",
            "https://store.example.com"
          )
        ).toThrow(/金额/);
      }
    );
  });

  it("支付网关必须使用 HTTPS", async () => {
    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_GATEWAY: "http://pay.example.com/epay",
      },
      async () => {
        expect(() =>
          createPayment(
            "ORDER_1",
            "12.34",
            "Test Product",
            "https://store.example.com"
          )
        ).toThrow(/HTTPS/);
      }
    );
  });

  it("ldcpay 私钥格式无效时应给出明确错误", async () => {
    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
        LDC_PAYMENT_PROTOCOL: "ldcpay",
        LDC_ED25519_PRIVATE_KEY_PKCS8_BASE64: "not-a-private-key",
      },
      async () => {
        expect(() =>
          createPayment(
            "ORDER_1",
            "12.34",
            "Test Product",
            "https://store.example.com"
          )
        ).toThrow(/私钥格式无效/);
      }
    );
  });

  it("商品名应按 Unicode 字符截取到 64 个字符", async () => {
    const productName = "😀".repeat(65);
    await withEnv(
      {
        LDC_CLIENT_ID: "1001",
        LDC_CLIENT_SECRET: "secret",
      },
      async () => {
        const result = createPayment(
          "ORDER_1",
          "12.34",
          productName,
          "https://store.example.com"
        );

        expect(Array.from(result.params.name)).toHaveLength(64);
        expect(result.params.name).toBe("😀".repeat(64));
      }
    );
  });
});
