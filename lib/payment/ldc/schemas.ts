import { z } from "zod";

import type { NotifyParams } from "./types";

const stringLikeSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value));

export const orderQueryResultSchema = z.object({
  code: z.coerce.number(),
  msg: z.string(),
  trade_no: stringLikeSchema,
  out_trade_no: z.string().min(1),
  type: z.string().min(1),
  pid: stringLikeSchema,
  addtime: z.string(),
  endtime: z.string(),
  name: z.string(),
  money: stringLikeSchema,
  status: z.coerce.number().int(),
});

export const refundResultSchema = z.object({
  code: z.coerce.number().int(),
  msg: z.string(),
});

export const notifyParamsSchema = z.object({
  pid: z.string().min(1),
  trade_no: z.string().min(1),
  out_trade_no: z.string().min(1),
  type: z.string().min(1),
  name: z.string().min(1),
  money: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  trade_status: z.literal("TRADE_SUCCESS"),
  sign_type: z.string().default(""),
  sign: z.string().regex(/^[a-fA-F0-9]{32}$/),
});

export function parseNotifyParams(input: unknown): NotifyParams | null {
  const result = notifyParamsSchema.safeParse(input);
  return result.success ? result.data : null;
}

export function isLikelyCloudflareBlock(html: string): boolean {
  const text = html.toLowerCase();
  return text.includes("just a moment") || text.includes("cloudflare");
}
