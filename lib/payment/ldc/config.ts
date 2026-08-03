import { z } from "zod";

import type { PaymentProtocol, RefundMode } from "./types";
import { LdcPaymentError } from "./errors";

const DEFAULT_GATEWAY = "https://credit.linux.do/epay";

function normalizeHttpsUrl(value: string, name: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new LdcPaymentError("CONFIG", `${name} 必须是有效 URL`);
  }

  if (url.protocol !== "https:") {
    throw new LdcPaymentError("CONFIG", `${name} 必须使用 HTTPS`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new LdcPaymentError(
      "CONFIG",
      `${name} 不得包含凭证、查询参数或片段`
    );
  }

  return url;
}

export function getPaymentProtocol(): PaymentProtocol {
  const result = z
    .enum(["epay", "ldcpay"])
    .safeParse((process.env.LDC_PAYMENT_PROTOCOL || "epay").toLowerCase());
  if (!result.success) {
    throw new LdcPaymentError(
      "CONFIG",
      "LDC_PAYMENT_PROTOCOL 必须是 epay 或 ldcpay"
    );
  }
  return result.data;
}

export function getRefundMode(): RefundMode {
  const envMode = process.env.LDC_REFUND_MODE?.toLowerCase();
  if (!envMode || envMode === "client" || envMode === "disabled") {
    return "disabled";
  }

  const result = z.enum(["server", "proxy"]).safeParse(envMode);
  if (!result.success) {
    throw new LdcPaymentError(
      "CONFIG",
      "LDC_REFUND_MODE 必须是 server、proxy 或 disabled"
    );
  }
  if (result.data === "proxy" && !process.env.LDC_PROXY_URL) {
    throw new LdcPaymentError(
      "CONFIG",
      "LDC_REFUND_MODE=proxy 时必须配置 LDC_PROXY_URL"
    );
  }
  return result.data;
}

export function isRefundEnabled(): boolean {
  return getRefundMode() !== "disabled";
}

export function getGatewayUrl(): string {
  const url = normalizeHttpsUrl(
    process.env.LDC_GATEWAY || DEFAULT_GATEWAY,
    "LDC_GATEWAY"
  );
  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = path.endsWith("/epay") ? path : `${path}/epay`;
  return url.toString().replace(/\/+$/, "");
}

export function getOfficialApiUrl(): string {
  return `${getGatewayUrl()}/api.php`;
}

export function getQueryApiUrl(): string {
  const proxyUrl = process.env.LDC_PROXY_URL;
  if (!proxyUrl) return getOfficialApiUrl();
  return normalizeHttpsUrl(proxyUrl, "LDC_PROXY_URL")
    .toString()
    .replace(/\/+$/, "");
}

export function getRefundApiUrl(mode: RefundMode): string {
  if (mode === "proxy") {
    return normalizeHttpsUrl(process.env.LDC_PROXY_URL!, "LDC_PROXY_URL")
      .toString()
      .replace(/\/+$/, "");
  }
  return getOfficialApiUrl();
}

export function getCredentials(): { clientId: string; secret: string } {
  const clientId = process.env.LDC_CLIENT_ID;
  const secret = process.env.LDC_CLIENT_SECRET;
  if (!clientId || !secret) {
    throw new LdcPaymentError(
      "CONFIG",
      "支付配置未设置：请配置 LDC_CLIENT_ID 和 LDC_CLIENT_SECRET"
    );
  }
  return { clientId, secret };
}
