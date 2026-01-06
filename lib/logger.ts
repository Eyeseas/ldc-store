import "server-only";

/**
 * 结构化日志（Node runtime）
 *
 * 为什么单独封装：
 * - 统一字段（requestId/userId/orderNo 等），方便跨模块检索与关联排障
 * - 统一脱敏策略，避免业务层日志“不小心”把敏感信息写出去
 *
 * 注意：Next.js middleware 运行在 Edge runtime，不应引入此文件（pino 依赖 Node 环境）
 */

import pino from "pino";
import { headers } from "next/headers";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  // 关键：日志中禁止出现敏感字段；这里做“兜底”脱敏，业务侧仍应尽量只记录白名单字段
  redact: {
    paths: [
      // 常见凭证/敏感字段
      "*.password",
      "*.secret",
      "*.token",
      "*.key",
      "password",
      "secret",
      "token",
      "key",
      // 请求相关敏感头
      "req.headers.authorization",
      "req.headers.cookie",
      "headers.authorization",
      "headers.cookie",
      // 支付回调签名
      "*.sign",
      "sign",
    ],
    remove: true,
  },
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          singleLine: false,
          ignore: "pid,hostname",
        },
      },
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}

/**
 * 从请求头获取 requestId（由 middleware 注入 x-request-id）
 */
export async function getRequestIdFromHeaders(): Promise<string | undefined> {
  try {
    const headersList = await headers();
    return headersList.get("x-request-id") || undefined;
  } catch {
    // 在无请求上下文（例如测试/脚本）场景下 headers() 可能不可用，
    // 这里返回 undefined，保证业务逻辑不被日志/上下文获取影响。
    return undefined;
  }
}
