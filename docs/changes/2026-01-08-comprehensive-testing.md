# 变更文档：Comprehensive Testing & CI（2026-01-08）

## 背景与目标

基于测试实施计划 `docs/TESTING_PLAN.md`，对项目核心链路补齐测试覆盖（Unit/Integration/Component），并将测试结果纳入 CI 产物（coverage artifact），为后续逐步抬高 coverage 阈值提供可回归的基线。

## 结果概览

- 测试体系：新增/补齐 **Unit + Integration + Component** tests，覆盖 `validations/*`、支付回调、退款模式、关键 UI 交互等。
- Property-based tests：引入 `fast-check`，为金额解析增加随机用例覆盖。
- CI：GitHub Actions 跑 `pnpm test:coverage` 并上传 `coverage/` 作为 artifact。
- 稳定性：本地连续运行 `pnpm vitest run` **5 次均通过**（用于排查 flaky）。

## 关键行为变更（需关注）

- 支付回调金额解析更严格：`app/api/payment/notify/route.ts` 由直接 `Number()` 解析改为 `parseWalletAmount()`。
  - 影响：将拒绝例如科学计数法（`1e2`）、异常千分位、超过 2 位小数等非预期格式（更安全、可控）。
- `OrderResultPage` 兼容 `searchParams` 的两种形态：Promise 与已解析对象。
  - 目的：在不同渲染路径/测试环境下形态差异不再导致运行时错误。

## 新增内容（按类别）

### 文档
- 测试实施计划（含进度勾选）：`docs/TESTING_PLAN.md`
- 本变更文档：`docs/changes/2026-01-08-comprehensive-testing.md`

### 工具函数
- 金额解析：`lib/money.ts`（`parseWalletAmount`）
- 时区日历加天：`lib/time/zoned.ts`（`addDaysInTimezone`）

### Tests
- Schema validations：
  - `tests/unit/validations/order.test.ts`
  - `tests/unit/validations/product.test.ts`
  - `tests/unit/validations/category.test.ts`
  - `tests/unit/validations/card.test.ts`
  - `tests/unit/validations/announcement.test.ts`
- Core utils：
  - `tests/unit/utils/amount.test.ts`（含 fast-check property-based）
  - `tests/unit/utils/time.test.ts`
  - `tests/unit/utils/card-url.test.ts`
- Integration：
  - `tests/integration/payment-notify.test.ts`
  - `tests/integration/refund.test.ts`
- Component：
  - `tests/unit/components/admin-cards-filters.test.tsx`
  - `tests/unit/components/order-result.test.tsx`
- Markdown/XSS：
  - `tests/unit/markdown.test.ts`

## 修改内容（重点文件）

- 支付回调金额解析：`app/api/payment/notify/route.ts`
- 订单结果页 searchParams 兼容：`app/(store)/order/result/page.tsx`
- Coverage 阈值基线（防回退）：`vitest.config.ts`
- CI 上传 coverage artifact：`.github/workflows/test.yml`
- 忽略本地 pnpm store：`.gitignore`
- 新增依赖：`package.json`、`pnpm-lock.yaml`（`fast-check`）

## 验证方式

本地运行：

- `pnpm vitest run`
- `pnpm test:coverage`（生成 `coverage/index.html`）

CI：

- GitHub Actions workflow：`.github/workflows/test.yml`
- 产物：`coverage/`（artifact 名称：`coverage`）

## 已知注意事项

- 若本机 pnpm 报 `ERR_PNPM_UNEXPECTED_STORE` / store 权限问题：
  - 建议使用项目内 store（本次已落为 `/.pnpm-store/`，并加入 `.gitignore`），必要时重装依赖后再执行 `pnpm add`。

## 后续建议

- 分阶段上调 `vitest.config.ts` 的 coverage thresholds（建议先提升 `lines/statements`，再逐步提高 `branches`）。
- 把 property-based tests 扩展到更多“输入解析/格式化/边界”类函数（例如 query string 归一化、时间范围处理等）。
