/**
 * Linux DO Credit 支付回调处理
 * 接收支付成功通知并更新订单状态
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySign, type NotifyParams } from "@/lib/payment/ldc";
import { handlePaymentSuccess } from "@/lib/actions/orders";
import { db, orders } from "@/lib/db";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

function toCents(value: string): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

function getRequestId(request: NextRequest): string {
  return request.headers.get("x-request-id") || crypto.randomUUID();
}

function toSafeNotifyLogFields(params: NotifyParams) {
  // 关键：避免记录 sign 等敏感字段；仅记录排障所需的最小白名单字段
  return {
    pid: params.pid,
    tradeNo: params.trade_no,
    orderNo: params.out_trade_no,
    paymentType: params.type,
    name: params.name,
    money: params.money,
    tradeStatus: params.trade_status,
    signType: params.sign_type,
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = getRequestId(request);
  const log = logger.child({ requestId, route: "/api/payment/notify" });

  const searchParams = request.nextUrl.searchParams;

  // 提取回调参数
  const params: NotifyParams = {
    pid: searchParams.get("pid") || "",
    trade_no: searchParams.get("trade_no") || "",
    out_trade_no: searchParams.get("out_trade_no") || "",
    type: searchParams.get("type") || "",
    name: searchParams.get("name") || "",
    money: searchParams.get("money") || "",
    trade_status: searchParams.get("trade_status") || "",
    sign_type: searchParams.get("sign_type") || "",
    sign: searchParams.get("sign") || "",
  };

  // 验证必要参数
  if (!params.out_trade_no || !params.sign || !params.pid || !params.trade_no || !params.money) {
    log.warn(
      {
        durationMs: Date.now() - startTime,
        params: toSafeNotifyLogFields(params),
      },
      "支付回调缺少必要参数"
    );
    return new NextResponse("fail", { status: 400 });
  }

  // 验证签名算法
  if (params.sign_type && params.sign_type.toUpperCase() !== "MD5") {
    log.warn(
      {
        durationMs: Date.now() - startTime,
        signType: params.sign_type,
        params: toSafeNotifyLogFields(params),
      },
      "支付回调 sign_type 不支持"
    );
    return new NextResponse("fail", { status: 400 });
  }

  // 验证签名
  const secret = process.env.LDC_CLIENT_SECRET;
  if (!secret) {
    log.error({ durationMs: Date.now() - startTime }, "LDC_CLIENT_SECRET 未配置");
    return new NextResponse("fail", { status: 500 });
  }

  // 验证商户号
  const merchantPid = process.env.LDC_CLIENT_ID;
  if (!merchantPid) {
    log.error({ durationMs: Date.now() - startTime }, "LDC_CLIENT_ID 未配置");
    return new NextResponse("fail", { status: 500 });
  }

  if (params.pid !== merchantPid) {
    log.warn(
      {
        durationMs: Date.now() - startTime,
        pid: params.pid,
        expectedPid: merchantPid,
        params: toSafeNotifyLogFields(params),
      },
      "支付回调 pid 不匹配"
    );
    return new NextResponse("fail", { status: 400 });
  }

  if (!verifySign(params, secret)) {
    log.warn(
      {
        durationMs: Date.now() - startTime,
        params: toSafeNotifyLogFields(params),
      },
      "支付回调签名验证失败"
    );
    return new NextResponse("fail", { status: 400 });
  }

  // 验证订单与金额（防御式校验）
  const order = await db.query.orders.findFirst({
    where: eq(orders.orderNo, params.out_trade_no),
    columns: {
      id: true,
      status: true,
      totalAmount: true,
      paymentMethod: true,
      tradeNo: true,
    },
  });

  if (!order) {
    log.warn(
      {
        durationMs: Date.now() - startTime,
        params: toSafeNotifyLogFields(params),
      },
      "支付回调订单不存在"
    );
    return new NextResponse("fail", { status: 400 });
  }

  if (order.paymentMethod !== "ldc") {
    log.warn(
      {
        durationMs: Date.now() - startTime,
        paymentMethod: order.paymentMethod,
        params: toSafeNotifyLogFields(params),
      },
      "支付回调支付方式不匹配"
    );
    return new NextResponse("fail", { status: 400 });
  }

  const expectedCents = toCents(order.totalAmount);
  const receivedCents = toCents(params.money);
  if (expectedCents === null || receivedCents === null || expectedCents !== receivedCents) {
    log.warn(
      {
        durationMs: Date.now() - startTime,
        expected: order.totalAmount,
        received: params.money,
        params: toSafeNotifyLogFields(params),
      },
      "支付回调金额不匹配"
    );
    return new NextResponse("fail", { status: 400 });
  }

  // 幂等：订单已处理则直接确认成功，避免支付平台重复通知
  if (order.status === "completed" || order.status === "paid") {
    log.info(
      {
        durationMs: Date.now() - startTime,
        orderId: order.id,
        orderStatus: order.status,
        params: toSafeNotifyLogFields(params),
      },
      "支付回调重复投递（已处理）"
    );
    return new NextResponse("success");
  }

  // 验证交易状态
  if (params.trade_status !== "TRADE_SUCCESS") {
    log.info(
      {
        durationMs: Date.now() - startTime,
        orderId: order.id,
        orderStatus: order.status,
        tradeStatus: params.trade_status,
        params: toSafeNotifyLogFields(params),
      },
      "交易状态非成功"
    );
    return new NextResponse("success");
  }

  // 非待支付状态不再重复处理（例如 expired/refunded）
  if (order.status !== "pending") {
    log.warn(
      {
        durationMs: Date.now() - startTime,
        orderId: order.id,
        orderStatus: order.status,
        params: toSafeNotifyLogFields(params),
      },
      "支付回调订单状态不可处理"
    );
    return new NextResponse("success");
  }

  // 处理支付成功
  try {
    const result = await handlePaymentSuccess(params.out_trade_no, params.trade_no);

    if (result) {
      log.info(
        {
          durationMs: Date.now() - startTime,
          orderId: order.id,
          params: toSafeNotifyLogFields(params),
        },
        "订单支付成功处理完成"
      );
      return new NextResponse("success");
    } else {
      // 兜底再查一次，避免并发/重复回调导致的误判
      const latest = await db.query.orders.findFirst({
        where: eq(orders.orderNo, params.out_trade_no),
        columns: { status: true },
      });
      if (latest?.status === "completed" || latest?.status === "paid") {
        log.info(
          {
            durationMs: Date.now() - startTime,
            orderId: order.id,
            latestStatus: latest.status,
            params: toSafeNotifyLogFields(params),
          },
          "订单状态已更新（兜底确认）"
        );
        return new NextResponse("success");
      }

      log.error(
        {
          durationMs: Date.now() - startTime,
          orderId: order.id,
          params: toSafeNotifyLogFields(params),
        },
        "订单处理失败"
      );
      return new NextResponse("fail", { status: 500 });
    }
  } catch (error) {
    log.error(
      {
        durationMs: Date.now() - startTime,
        orderId: order.id,
        err: error,
        params: toSafeNotifyLogFields(params),
      },
      "处理支付回调异常"
    );
    return new NextResponse("fail", { status: 500 });
  }
}
