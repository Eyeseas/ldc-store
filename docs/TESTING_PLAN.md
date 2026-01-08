# 测试实施计划（Testing Plan）

- 来源：`https://alist.kong.vision/d/r2/public/docs/1.md`
- 维护文件：`docs/TESTING_PLAN.md`
- 最近更新：2026-01-08

> 说明：本文件用 checkbox 记录“是否已完成”，并在每个条目下补充验收点与落地位置。

## 1. Scaffolding and Setup

- [x] 1.1 Verify Existing Configuration（`vitest.config.ts`、`tests/setup.ts`、`package.json scripts`）
  - 覆盖点：`@/` alias；`@testing-library/jest-dom`；`test/test:coverage/test:ui` scripts。
- [x] 1.2 Add Property-Based Testing Library（fast-check，可选）
  - 依赖：`fast-check`
  - 用例：`tests/unit/utils/amount.test.ts`（property-based）

## 2. Documentation Familiarization

- [x] 2.1 Review local docs/wiki（`helloagents/wiki/*`、`docs/*`）
  - 重点：Order creation & validation、Admin order/card management、Payment notify/refund、Markdown/Sanitization。

## 3. Unit Tests for Schema Validation

- [x] 3.1 Order Schema（`tests/unit/validations/order.test.ts`）
  - 覆盖：`createOrderSchema`（UUID/数量边界/default paymentMethod）、`updateOrderStatusSchema`（status enum）。
- [x] 3.2 Product Schema（`tests/unit/validations/product.test.ts`）
  - 覆盖：必填字段、`slug` regex、`coverImage`（""/null/url）、partial update。
- [x] 3.3 Category Schema（`tests/unit/validations/category.test.ts`）
  - 覆盖：`slug` regex、默认值（`isActive/sortOrder`）、partial update。
- [x] 3.4 Card Schema（`tests/unit/validations/card.test.ts`）
  - 覆盖：内容 trim/空值、UUID 校验、batch action 约束、delimiter 默认值。
- [x] 3.5 Announcement Schema（`tests/unit/validations/announcement.test.ts`）
  - 覆盖：datetime-local 格式、`endAt >= startAt`、start/end 可选。

## 4. Unit Tests for Core Utilities

- [x] 4.1 Wallet Amount Parsing（`lib/money.ts` + `tests/unit/utils/amount.test.ts`）
  - 覆盖：整数/两位小数/空格/千分位；拒绝负数/科学计数法/异常分组；property-based 随机用例。
- [x] 4.2 Timezone Date Math（`lib/time/zoned.ts` + `tests/unit/utils/time.test.ts`）
  - 覆盖：UTC；Asia/Shanghai；America/New_York（DST 前进/回退）。
- [x] 4.3 Card URL Formatting（`tests/unit/utils/card-url.test.ts`）
  - 覆盖：`buildAdminCardsHref`（省略默认参数、page<=1 省略、参数拼接）。

## 5. Unit Tests for Server Actions

- [x] 5.1 Order Creation Action（`tests/unit/orders.test.ts`）
  - 说明：任务清单原建议 `tests/unit/actions/createOrder.test.ts`；本仓库已有等价覆盖（mock `lib/db`/`auth` 等）。
- [x] 5.2 Admin Order Deletion Action（`tests/unit/admin-orders.test.ts`）
- [x] 5.3 Card Creation Action（`tests/unit/cards.test.ts`）

## 6. Integration Tests

- [x] 6.1 Payment Notification Route（`tests/integration/payment-notify.test.ts`）
  - 覆盖：缺参/验签失败/pid 不匹配/金额不匹配/幂等/`TRADE_SUCCESS` 分支。
- [x] 6.2 Payment Refund Logic（Proxy/Client Modes）（`tests/integration/refund.test.ts`）
  - 覆盖：`getRefundMode/isRefundEnabled`；`refundOrder`（proxy/gateway）；`getClientRefundParams`。

## 7. Component Tests

- [x] 7.1 Admin Cards Page Filtering UI（`tests/unit/components/admin-cards-filters.test.tsx`）
  - 覆盖：应用筛选/重置/清空搜索（`useRouter().push`）。
- [x] 7.2 Order Result Page Rendering（`tests/unit/components/order-result.test.tsx`）
  - 覆盖：`pending/paid/completed/expired/refunded` 文案；completed 展示卡密；pending 提示轮询。

## 8. Markdown and Sanitization Tests

- [x] 8.1 Markdown Rendering（`tests/unit/markdown.test.ts`）
  - 覆盖：link 安全属性、code block、移除 `script`、禁止 `javascript:` scheme、限制 `img` scheme。

## 9. Coverage and CI Enforcement

- [x] 9.1 Add Coverage Thresholds（基线阈值已在 `vitest.config.ts` 配置，后续逐步上调）
  - 当前基线：lines/statements=9、branches=65、functions=50。
  - 目标建议（参考任务清单原文）：lines>=90、branches>=85、functions>=90、statements>=90（需分阶段达成）。
- [x] 9.2 Add CI Workflow（`.github/workflows/test.yml`）
  - 步骤：install → `pnpm test:coverage`。
- [x] 9.3 Upload coverage report artifact（`.github/workflows/test.yml`）
  - 产物：`coverage/`（artifact 名称：`coverage`）。

## 10. Execution Checklist

- [x] 10.1 Run `pnpm test`（等价：`pnpm vitest run`）
- [x] 10.2 Run `pnpm test:coverage`
- [x] 10.3 Inspect coverage HTML output（`coverage/index.html` / CI artifact）
- [x] 10.4 Confirm no flaky tests（本地连续运行 `pnpm vitest run` 5 次均通过）
- [x] 10.5 Ensure mocks isolate DB and network（单测已 mock `lib/db`/`fetch` 等关键依赖）

## Notes

- 优先写 Unit tests 覆盖纯业务逻辑与 schema 校验；Integration tests 聚焦 route handler 与支付流程。
- Mock 要“最小但一致”（避免引入真实 DB 连接与不稳定网络）。
- 非必要不做 snapshot tests（更容易产生无意义 diff）。
