/**
 * 金额/积分解析工具
 *
 * 设计动机：
 * - 外部系统（支付平台、用户输入）传入的金额字符串格式不稳定（空格/千分位/非法字符）
 * - 这里集中做一次严格解析，避免“Number(value)”默默接受科学计数法等意外格式
 */

/**
 * 解析钱包/支付金额字符串为 number。
 *
 * 规则：
 * - 允许：`123`、`123.4`、`123.45`
 * - 允许千分位：`1,234.56`
 * - 不允许：负数、科学计数法、超过 2 位小数、异常逗号分组
 *
 * @returns 解析失败返回 null
 */
export function parseMoneyToCents(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;

  const plain = /^\d+(?:\.\d{1,2})?$/.test(raw);
  const withThousands = /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(raw);
  if (!plain && !withThousands) return null;

  const [whole, fraction = ""] = raw.replace(/,/g, "").split(".");
  const wholeAmount = Number(whole);
  const fractionAmount = Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(wholeAmount)) return null;

  const cents = wholeAmount * 100 + fractionAmount;
  return Number.isSafeInteger(cents) ? cents : null;
}

export function formatCents(cents: number): string | null {
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function multiplyMoney(value: string, quantity: number): string | null {
  const unitCents = parseMoneyToCents(value);
  if (unitCents === null || !Number.isSafeInteger(quantity) || quantity <= 0) {
    return null;
  }

  const totalCents = unitCents * quantity;
  return Number.isSafeInteger(totalCents) ? formatCents(totalCents) : null;
}

export function parseWalletAmount(value: string): number | null {
  const cents = parseMoneyToCents(value);
  return cents === null ? null : cents / 100;
}
