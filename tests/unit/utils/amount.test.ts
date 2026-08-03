import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  formatCents,
  multiplyMoney,
  parseMoneyToCents,
  parseWalletAmount,
} from "@/lib/money";

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function formatThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

describe("utils/amount", () => {
  it("应解析整数金额字符串", () => {
    expect(parseWalletAmount("10")).toBe(10);
  });

  it("应解析小数金额字符串（最多两位）", () => {
    expect(parseWalletAmount("10.5")).toBe(10.5);
    expect(parseWalletAmount("10.50")).toBe(10.5);
  });

  it("应处理前后空格与千分位", () => {
    expect(parseWalletAmount(" 1,234.56 ")).toBe(1234.56);
  });

  it("应拒绝非法数字字符串", () => {
    expect(parseWalletAmount("abc")).toBeNull();
    expect(parseWalletAmount("1.234")).toBeNull();
    expect(parseWalletAmount("1,2,3")).toBeNull();
    expect(parseWalletAmount("1e2")).toBeNull();
  });

  it("应拒绝负数", () => {
    expect(parseWalletAmount("-1")).toBeNull();
    expect(parseWalletAmount("-0.01")).toBeNull();
  });

  it("应以整数分解析、格式化和相乘金额", () => {
    expect(parseMoneyToCents("0.10")).toBe(10);
    expect(parseMoneyToCents("1,234.5")).toBe(123450);
    expect(formatCents(30)).toBe("0.30");
    expect(multiplyMoney("0.10", 3)).toBe("0.30");
    expect(multiplyMoney("99999999.99", 100)).toBe("9999999999.00");
  });

  it("金额整数运算应拒绝非法值和不安全整数", () => {
    expect(parseMoneyToCents("1.234")).toBeNull();
    expect(formatCents(-1)).toBeNull();
    expect(multiplyMoney("10.00", 0)).toBeNull();
    expect(multiplyMoney("99999999999999.99", 100)).toBeNull();
  });

  it("property: 应正确解析两位小数金额（含千分位与空格）", () => {
    // 为什么要做 property-based：金额字符串来自外部系统/用户输入，组合形态多；
    // 用随机生成能覆盖更多“看起来正常但边界奇怪”的格式，降低回归风险。
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000_000 }), (cents) => {
        const dollars = Math.floor(cents / 100);
        const centsPart = String(cents % 100).padStart(2, "0");

        const plain = `${dollars}.${centsPart}`;
        const parsedPlain = parseWalletAmount(plain);
        expect(parsedPlain).not.toBeNull();
        if (parsedPlain === null) return;
        expect(toCents(parsedPlain)).toBe(cents);

        const withCommaAndSpaces = `  ${formatThousands(dollars)}.${centsPart}  `;
        const parsedComma = parseWalletAmount(withCommaAndSpaces);
        expect(parsedComma).not.toBeNull();
        if (parsedComma === null) return;
        expect(toCents(parsedComma)).toBe(cents);
      }),
      { numRuns: 200 }
    );
  });
});
