/**
 * Linux DO Credit 支付集成
 * 基于 EasyPay 兼容协议
 */

import { formatCents, parseMoneyToCents } from "@/lib/money";
import {
  getCredentials,
  getGatewayUrl,
  getPaymentProtocol,
  getQueryApiUrl,
  getRefundApiUrl,
  getRefundMode,
} from "./ldc/config";
import {
  generateEd25519Sign,
  generateSign,
  verifySign,
} from "./ldc/signatures";
import {
  isLikelyCloudflareBlock,
  orderQueryResultSchema,
  refundResultSchema,
} from "./ldc/schemas";
import type {
  LdcPayParams,
  NotifyParams,
  OrderQueryResult,
  PaymentFormData,
  PaymentParams,
  RefundResult,
} from "./ldc/types";
import { LdcPaymentError } from "./ldc/errors";

export {
  getPaymentProtocol,
  getRefundMode,
  isRefundEnabled,
} from "./ldc/config";
export { generateSign, verifySign } from "./ldc/signatures";
export { parseNotifyParams } from "./ldc/schemas";
export { LdcPaymentError } from "./ldc/errors";
export type { LdcPaymentErrorCode } from "./ldc/errors";
export type {
  NotifyParams,
  OrderQueryResult,
  PaymentFormData,
  PaymentParams,
  PaymentProtocol,
  RefundMode,
} from "./ldc/types";

function createTimeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal !== "undefined" &&
    typeof (AbortSignal as unknown as { timeout?: unknown }).timeout === "function"
    ? (AbortSignal as unknown as { timeout: (ms: number) => AbortSignal }).timeout(
        10_000
      )
    : undefined;
}

function isTimeoutError(error: unknown): boolean {
  const errorName =
    typeof error === "object" && error !== null && "name" in error
      ? String(error.name)
      : "";
  return errorName === "TimeoutError" || errorName === "AbortError";
}

/**
 * 创建支付订单
 * 返回表单数据，由前端创建表单并 POST 提交（绕过 Cloudflare）
 * @param orderId 订单号
 * @param amount 金额
 * @param productName 商品名称
 * @param siteUrl 网站地址（用于回调）
 */
export function createPayment(
  orderId: string,
  amount: string,
  productName: string,
  siteUrl: string
): PaymentFormData {
  const protocol = getPaymentProtocol();
  const gateway = getGatewayUrl();
  const { clientId: pid, secret } = getCredentials();

  const amountCents = parseMoneyToCents(amount);
  const normalizedAmount =
    amountCents !== null && amountCents > 0 ? formatCents(amountCents) : null;
  if (!normalizedAmount) {
    throw new LdcPaymentError("INVALID_INPUT", "支付金额格式无效");
  }
  const normalizedProductName = Array.from(productName).slice(0, 64).join("");
  if (!normalizedProductName.trim()) {
    throw new LdcPaymentError("INVALID_INPUT", "支付商品名称不能为空");
  }

  const common = {
    out_trade_no: orderId,
    money: normalizedAmount,
    notify_url: `${siteUrl}/api/payment/notify`,
    return_url: `${siteUrl}/order/result?out_trade_no=${orderId}`,
  };

  let formParams: Record<string, string>;
  if (protocol === "ldcpay") {
    const privateKey = process.env.LDC_ED25519_PRIVATE_KEY_PKCS8_BASE64;
    if (!privateKey) {
      throw new LdcPaymentError(
        "CONFIG",
        "支付配置未设置：ldcpay 需要 LDC_ED25519_PRIVATE_KEY_PKCS8_BASE64"
      );
    }

    const params: LdcPayParams = {
      client_id: pid,
      type: "ldcpay",
      ...common,
      order_name: normalizedProductName,
    };
    formParams = {
      ...params,
      sign: generateEd25519Sign(
        params as unknown as Record<string, string>,
        secret,
        privateKey
      ),
    };
  } else {
    const params: PaymentParams = {
      pid,
      type: "epay",
      ...common,
      name: normalizedProductName,
    };
    formParams = {
      ...params,
      sign: generateSign(params as unknown as Record<string, string>, secret),
      sign_type: "MD5",
    };
  }

  if (process.env.NODE_ENV === "development") {
    console.log("LDC 支付表单数据:", {
      actionUrl: `${gateway}/pay/submit.php`,
      protocol,
      orderId,
      amount: normalizedAmount,
    });
  }

  return {
    actionUrl: `${gateway}/pay/submit.php`,
    params: formParams,
  };
}

/**
 * 查询订单状态
 * 支持通过 LDC_PROXY_URL 代理请求
 */
export async function queryPaymentOrder(input: {
  outTradeNo: string;
}): Promise<OrderQueryResult | null> {
  const { clientId: pid, secret } = getCredentials();

  if (!input.outTradeNo) {
    throw new LdcPaymentError("INVALID_INPUT", "查询订单缺少 outTradeNo");
  }

  const apiUrl = getQueryApiUrl();
  const searchParams = new URLSearchParams({
    act: "order",
    pid,
    key: secret,
  });

  searchParams.set("out_trade_no", input.outTradeNo);

  const url = `${apiUrl}?${searchParams}`;
  console.log("LDC 订单查询请求:", url.replace(secret, "***"));

  let response: Response;
  try {
    response = await fetch(url, {
      signal: createTimeoutSignal(),
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new LdcPaymentError("TIMEOUT", "支付平台订单查询请求超时", {
        cause: error,
        retryable: true,
      });
    }
    throw error;
  }

  const text = await response.text();

  // 文档补充：订单不存在会返回 HTTP 404。
  if (response.status === 404) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    if (isLikelyCloudflareBlock(text)) {
      throw new LdcPaymentError(
        "BLOCKED",
        "支付平台被 Cloudflare 拦截，请配置 LDC_PROXY_URL 环境变量使用代理",
        { retryable: true }
      );
    }
    throw new LdcPaymentError(
      "INVALID_RESPONSE",
      "支付平台返回格式异常，请检查订单查询接口配置"
    );
  }

  try {
    const raw = JSON.parse(text) as Partial<OrderQueryResult> & {
      code?: number | string;
      status?: number | string;
      msg?: string;
    };

    const code = Number(raw.code);
    if (code !== 1) {
      if (code === -1) return null;
      throw new LdcPaymentError(
        "PLATFORM_REJECTED",
        raw.msg || "查询订单失败"
      );
    }

    const result = orderQueryResultSchema.safeParse(raw);
    if (!result.success) {
      throw new LdcPaymentError(
        "INVALID_RESPONSE",
        "支付平台订单查询响应格式异常"
      );
    }

    return result.data;
  } catch (e) {
    console.error("订单查询响应解析失败:", text.substring(0, 200));
    throw e;
  }
}

/**
 * 退款
 * 使用 POST 请求调用退款接口
 * 支持通过 LDC_PROXY_URL 代理请求
 * 文档: POST /api.php, 支持 application/x-www-form-urlencoded 或 application/json
 */
export async function refundOrder(
  tradeNo: string,
  money: string
): Promise<RefundResult> {
  const refundMode = getRefundMode();
  if (refundMode === "disabled") {
    throw new LdcPaymentError("CONFIG", "退款功能未启用");
  }
  if (!tradeNo.trim()) {
    throw new LdcPaymentError("INVALID_INPUT", "退款缺少支付平台流水号");
  }
  const refundCents = parseMoneyToCents(money);
  if (!/^\d+\.\d{2}$/.test(money) || refundCents === null || refundCents <= 0) {
    throw new LdcPaymentError(
      "INVALID_INPUT",
      "退款金额必须是大于 0 的两位小数字符串"
    );
  }

  const { clientId: pid, secret } = getCredentials();
  const apiUrl = getRefundApiUrl(refundMode);
  const body = new URLSearchParams({
    pid,
    key: secret,
    trade_no: tradeNo,
    money,
  });

  console.log("LDC 退款请求:", apiUrl, "参数:", { pid, trade_no: tradeNo, money });

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: body.toString(),
      signal: createTimeoutSignal(),
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new LdcPaymentError("TIMEOUT", "支付平台退款请求超时", {
        cause: error,
        retryable: true,
      });
    }
    throw error;
  }

  // 检查响应内容类型
  const contentType = response.headers.get("content-type");
  const text = await response.text();

  console.log("LDC 退款响应状态:", response.status, "类型:", contentType);

  // 如果不是 JSON 响应，抛出友好错误
  if (!contentType?.includes("application/json")) {
    console.error("退款接口返回非 JSON 响应:", text.substring(0, 500));
    
    // 检查是否是 Cloudflare 拦截
    if (isLikelyCloudflareBlock(text)) {
      throw new LdcPaymentError(
        "BLOCKED",
        "支付平台被 Cloudflare 拦截，请配置 LDC_PROXY_URL 环境变量使用代理",
        { retryable: true }
      );
    }
    
    throw new LdcPaymentError(
      "INVALID_RESPONSE",
      "支付平台返回格式异常，请检查退款接口配置"
    );
  }

  try {
    const result = refundResultSchema.safeParse(JSON.parse(text));
    if (!result.success) {
      throw new LdcPaymentError(
        "INVALID_RESPONSE",
        "支付平台退款响应格式异常"
      );
    }
    return result.data;
  } catch (error) {
    if (error instanceof Error && error.message.includes("响应格式异常")) {
      throw error;
    }
    console.error("退款接口 JSON 解析失败:", text.substring(0, 500));
    throw new LdcPaymentError(
      "INVALID_RESPONSE",
      "支付平台响应解析失败",
      { cause: error }
    );
  }
}
