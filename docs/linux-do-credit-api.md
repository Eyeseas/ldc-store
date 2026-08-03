# Linux DO Credit API 调研与对接基线

> 核对日期：2026-08-02
>
> 官方文档标注更新时间：2026-04-20
>
> 主要来源：[Linux DO Credit API 文档](https://credit.linux.do/docs/api)
>
> 交叉核对：[Linux DO Credit 官方仓库 v1.3.21](https://github.com/linux-do/credit/tree/v1.3.21)（提交 `f9026267704133be7a700be9e5f702c5dfee471e`）

本文是本项目实现 Linux DO Credit 支付时的协议基线。官方网页与官方源码不一致的地方会明确列出；实际开发应采用本文的保守建议，并在上线前用测试应用完成联调。

## 1. 本次核对后的关键变化

1. **官方原生接口已经上线。** 原生协议使用 `type=ldcpay` 和 Ed25519 签名，不再是旧文档所述的“暂未上线”。易支付兼容协议 `type=epay` 仍然可用。[官方原生接口](https://credit.linux.do/docs/api#1-1-overview)；[官方文档源码](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/frontend/components/common/docs/api.tsx#L20-L128)
2. **两种协议共用支付网关和后续接口。** 发起支付均使用 `https://credit.linux.do/epay/pay/submit.php`；订单查询和退款共用 `https://credit.linux.do/epay/api.php`。[官方原生发起](https://credit.linux.do/docs/api#1-4-submit)；[官方公共接口](https://credit.linux.do/docs/api#3-common-services)
3. **订单级回调地址现在会生效。** 发起订单时传入的 `notify_url`、`return_url` 会覆盖应用级配置；未传时才回退到应用的 `notify_url`、`redirect_uri`。[官方原生发起参数](https://credit.linux.do/docs/api#1-4-submit)；[回调地址选择实现](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/tasks.go#L63-L75)
4. **回调中没有 `sign_type` 字段。** 公开页面列出的字段是 `pid`、`trade_no`、`out_trade_no`、`type`、`name`、`money`、`trade_status` 和 `sign`，但没有明确说明 `ldcpay` 订单的通知验签算法。当前稳定源码 `v1.3.21` 的实现是固定发送 `type=epay`，并对所有通知使用 MD5 兼容签名；这是实现观察，必须通过联调确认，不能视为已版本化的公开承诺。[官方通知参数](https://credit.linux.do/docs/api#3-3-notify)；[v1.3.21 回调构造实现](https://github.com/linux-do/credit/blob/v1.3.21/internal/apps/payment/tasks.go#L78-L89)
5. **公开网页和当前源码仍有不一致。** 主要涉及易支付 `out_trade_no` 是否必填、支付发起是否真正支持 JSON、回调重试次数。详见[第 10 节](#10-官方资料中的不一致与未承诺项)。

## 2. 接口总览

| 能力 | 方法 | 完整地址 | 鉴权/签名 | 响应形态 |
| --- | --- | --- | --- | --- |
| 原生支付发起 | POST | `https://credit.linux.do/epay/pay/submit.php` | `client_id` + Ed25519 | 成功返回 `302` 跳转 |
| 易支付兼容发起 | POST | `https://credit.linux.do/epay/pay/submit.php` | `pid` + MD5 | 成功返回 `302` 跳转 |
| 订单查询 | GET | `https://credit.linux.do/epay/api.php` | `pid` + `key` | `{code,msg,...}` |
| 全额退款 | POST | `https://credit.linux.do/epay/api.php` | `pid` + `key` | `{code,msg}` |
| 异步通知 | GET | 商户配置的 `notify_url` | 页面仅给出 `sign`；v1.3.21 实现为 MD5 | 商户返回 `success` |
| 商户分发 | POST | `https://credit.linux.do/lpay/distribute` | HTTP Basic | `{error_msg,data}` |
| 用户余额统计 | GET | `https://credit.linux.do/api/v1/dashboard/stats/user-balance` | 无 | `{error_msg,data}` |

公开路径由前端反向代理到后端的 `/pay/submit.php`、`/api.php` 和 `/pay/distribute`；生产接入应始终使用上表中的公开地址。[官方路由映射](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/frontend/next.config.ts#L7-L24)；[后端路由](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/router/router.go#L108-L115)

## 3. 应用与密钥

在 Linux DO Credit 控制台创建应用后，会获得 `Client ID` 和 `Client Secret`：

- 原生协议请求字段使用 `client_id`；兼容协议和公共查询/退款接口分别使用 `pid`、`key`。
- 应用必须配置异步通知地址；同步回跳地址可以按应用配置，也可以由订单级 `return_url` 覆盖。
- 使用原生协议时，还需上传 **标准 Base64 编码的 32 字节 Ed25519 原始公钥**。私钥只保存在商户服务端，不上传、不进入浏览器、不写日志。[官方应用字段与公钥校验](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/merchant/api_key/routers.go#L31-L95)

## 4. 官方原生支付发起（推荐目标）

### 4.1 请求

- 方法：`POST`
- 地址：`https://credit.linux.do/epay/pay/submit.php`
- 官方页面声明的编码：`application/json` 或 `application/x-www-form-urlencoded`
- 工程基线：**使用 `application/x-www-form-urlencoded`**，原因见[第 10 节](#10-官方资料中的不一致与未承诺项)。

字段定义如下。[官方原生发起](https://credit.linux.do/docs/api#1-4-submit)；[服务端请求模型](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/middlewares.go#L57-L67)

| 字段 | 必填 | 约束 |
| --- | --- | --- |
| `client_id` | 是 | 应用 Client ID |
| `type` | 是 | 固定为 `ldcpay` |
| `out_trade_no` | 是 | 商户业务单号，1～64 字符；同一应用内保持唯一 |
| `money` | 是 | 大于 0、最多 2 位小数；原生签名时固定格式化为 2 位小数 |
| `order_name` | 是 | 商品/订单名称，最多 64 字符 |
| `notify_url` | 否 | 最多 100 字符且为合法 URL；覆盖应用异步通知地址 |
| `return_url` | 否 | 最多 100 字符且为合法 URL；覆盖应用同步回跳地址 |
| `sign` | 是 | Ed25519 签名的标准 Base64 编码 |

### 4.2 Ed25519 签名

待签名字符串按以下步骤生成：[官方原生签名说明](https://credit.linux.do/docs/api#1-3-auth-sign)；[服务端验签实现](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/utils.go#L304-L348)

1. 使用字段白名单：`client_id`、`type`、`out_trade_no`、`order_name`、`notify_url`、`return_url`、`money`。
2. 排除空值和 `sign`，按字段名 ASCII 升序排列。
3. 拼接为 `k1=v1&k2=v2`；值使用业务原值，不先做 URL 编码。
4. 将 `Client Secret` **直接追加**到末尾，不增加 `&` 或其他分隔符。
5. 用商户 Ed25519 私钥对 UTF-8 字节签名。
6. 用标准 Base64（不是 Base64URL）编码 64 字节签名，得到 `sign`。

示例待签名数据：

```text
client_id=1&money=10.00&order_name=Test&out_trade_no=M1&type=ldcpay{CLIENT_SECRET}
```

实现时必须将 `money` 规范化为恰好两位小数，例如 `10.00`。可选字段为空时不要加入待签名字符串。

### 4.3 成功、失败与幂等

验签并创建订单成功后，平台返回 HTTP `302 Found`，`Location` 指向 `https://credit.linux.do/paying?order_no=...`；失败使用 `{ "error_msg": "...", "data": null }` 形态。[官方支付发起说明](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/frontend/components/common/docs/api.tsx#L199-L205)；[创建订单响应实现](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/routers.go#L93-L164)

当前官方实现以 `(client_id, out_trade_no)` 作为幂等键：原订单仍待支付且所有参数完全一致时复用；相同业务单号但参数不同返回 HTTP `409`，订单已完成或过期则拒绝复用。[官方幂等实现](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/utils.go#L76-L139)

## 5. 易支付兼容支付发起

### 5.1 请求

- 方法：`POST`
- 地址：`https://credit.linux.do/epay/pay/submit.php`
- 编码：工程基线使用 `application/x-www-form-urlencoded`
- 协议兼容：EasyPay / CodePay / VPay

字段定义如下。[官方易支付发起](https://credit.linux.do/docs/api#2-5-submit)；[服务端请求模型](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/middlewares.go#L43-L55)

| 字段 | 必填 | 约束 |
| --- | --- | --- |
| `pid` | 是 | Client ID |
| `type` | 是 | 固定为 `epay` |
| `out_trade_no` | **是** | 1～64 字符；官方网页表格写“否”，但当前服务端绑定为必填 |
| `name` | 是 | 标题，最多 64 字符 |
| `money` | 是 | 大于 0，最多 2 位小数 |
| `notify_url` | 否 | 最多 100 字符且为合法 URL；覆盖应用通知地址 |
| `return_url` | 否 | 最多 100 字符且为合法 URL；覆盖应用回跳地址 |
| `device` | 否 | 终端标识 |
| `sign` | 是 | MD5 签名 |
| `sign_type` | 否 | 兼容字段，传值时固定 `MD5`；不参与签名 |

### 5.2 MD5 兼容签名

签名步骤如下：[官方易支付签名说明](https://credit.linux.do/docs/api#2-4-auth-sign)；[官方签名实现](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/utils.go#L223-L302)

1. 使用本次请求的非空协议字段，排除 `sign` 和 `sign_type`。
2. 按字段名 ASCII 升序排列，拼接为 `k1=v1&k2=v2`。
3. 将 `Client Secret` 直接追加到末尾。
4. 对 UTF-8 字节计算 MD5，以十六进制字符串作为 `sign`。统一输出小写；当前服务端比较时不区分大小写。

```text
money=10.00&name=Test&out_trade_no=M20250101&pid=001&type=epay{CLIENT_SECRET}
```

金额建议统一签成两位小数。当前服务端兼容 `10.00` 和 `10` 两种规范形式，但 `10.0` 这类中间形式可能验签失败，不应依赖。[金额签名兼容实现](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/utils.go#L277-L299)

## 6. 订单查询

- 方法：`GET`
- 地址：`https://credit.linux.do/epay/api.php`
- 认证：查询参数中的 `pid` + `key`
- 适用范围：`ldcpay` 与 `epay` 共用

请求字段和行为由官方公共接口文档及当前实现共同确认。[官方查询文档](https://credit.linux.do/docs/api#3-1-order)；[查询实现](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/routers.go#L76-L82)

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `act` | 否 | 兼容字段，可传 `order`；当前后端不校验其值 |
| `pid` | 是 | Client ID |
| `key` | 是 | Client Secret |
| `out_trade_no` | 是 | 商户业务单号，1～64 字符 |

成功响应示例：

```json
{
  "code": 1,
  "msg": "查询订单号成功！",
  "trade_no": "123456",
  "out_trade_no": "M20250101",
  "type": "ldcpay",
  "pid": "001",
  "addtime": "2026-08-02 12:00:00",
  "endtime": "2026-08-02 12:01:30",
  "name": "Test",
  "money": "10.00",
  "status": 1
}
```

关键语义：[官方响应实现](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/routers.go#L166-L229)

- `trade_no` 是平台内部数字订单号，退款时必须使用它；不要假设它等于 `out_trade_no`。
- `type` 返回原订单的支付类型，可能是 `ldcpay` 或 `epay`。
- `status=1` 仅表示订单当前为成功状态；`status=0` 表示所有其他状态。**不能把 `0` 直接解释为终态失败**，应继续结合本地订单超时策略轮询。
- 订单不存在返回 HTTP `404` 和 `{ "code": -1, "msg": "订单不存在或已完成" }`；参数或凭据错误通常返回 HTTP `400`、`code=-1`。

由于 `key` 位于 GET 查询串中，查询只能由服务端通过 HTTPS 调用，并应在反向代理、APM 和应用日志中对 `key` 及完整 URL 做脱敏。

## 7. 异步通知

### 7.1 请求与字段

支付认证成功后，平台对订单级 `notify_url` 发起 HTTP GET；未设置订单级地址时使用应用通知地址。[官方通知文档](https://credit.linux.do/docs/api#3-3-notify)；[通知发送实现](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/tasks.go#L41-L120)

| 字段 | 说明 |
| --- | --- |
| `pid` | Client ID |
| `trade_no` | 平台内部数字订单号 |
| `out_trade_no` | 商户业务单号 |
| `type` | 页面写固定 `epay`；v1.3.21 即使原订单使用 `ldcpay` 也发送 `epay` |
| `name` | 订单标题 |
| `money` | 两位小数字符串 |
| `trade_status` | 固定为 `TRADE_SUCCESS` |
| `sign` | 页面未区分协议算法；v1.3.21 使用 MD5 兼容签名 |

公开页面的通知字段**不包含** `sign_type`、时间戳或随机数，也没有明确说明原生 `ldcpay` 通知应采用 Ed25519 还是 MD5。当前 `v1.3.21` 实现按第 5.2 节的 MD5 规则处理所有通知：排除 `sign`，其余非空字段 ASCII 排序后追加 `Client Secret` 再计算 MD5。本项目应先按该实现对接，并把原生订单通知验签列为上线前强制联调项。[官方通知字段](https://credit.linux.do/docs/api#3-3-notify)；[v1.3.21 回调字段与签名实现](https://github.com/linux-do/credit/blob/v1.3.21/internal/apps/payment/tasks.go#L78-L89)

### 7.2 回应与重试

商户必须返回 HTTP `200`，且响应体去除首尾空白、转小写后严格等于 `success`；否则平台视为失败并重试。[官方回调成功判定](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/tasks.go#L102-L142)

官方网页写“最多 5 次、单次 30 秒超时”，但当前官方源码为任务 `MaxRetry(10)`、任务超时 30 秒，底层 HTTP 客户端超时 10 秒。因此业务实现不能依赖精确重试次数；回调必须可重复处理并尽快响应。[官方网页说明](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/frontend/components/common/docs/api.tsx#L419-L424)；[当前任务配置](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/service/payment.go#L244-L258)；[HTTP 客户端配置](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/util/http_clients.go#L40-L48)

### 7.3 商户侧处理要求

1. 只接受 HTTPS 公开地址上的 GET 回调。
2. 使用字段白名单重建待签名串，采用常量时间比较验证 `sign`。
3. 同时校验 `pid`、`out_trade_no`、`money`、`trade_status` 与本地订单；金额比较使用定点小数，不使用浮点数。
4. 以 `out_trade_no` 或本地订单 ID 做唯一键，在同一数据库事务中完成“未支付 → 已支付”和发货；重复通知直接返回 `success`。
5. 未验签、金额不符或订单不存在时不要返回 `success`；记录脱敏审计日志并触发告警。
6. 若通知长期未到，使用订单查询接口主动对账。

第 2～6 项是根据当前回调缺少时间戳/随机数且平台会重试所提出的商户侧安全要求，并非平台额外提供了防重放机制。[当前回调完整字段集](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/tasks.go#L78-L95)

## 8. 全额退款

- 方法：`POST`
- 地址：`https://credit.linux.do/epay/api.php`
- 编码：`application/json` 或 `application/x-www-form-urlencoded`
- 限制：仅支持成功支付订单的**全额退款**
- 适用范围：`ldcpay` 与 `epay` 共用

请求字段如下。[官方退款文档](https://credit.linux.do/docs/api#3-2-refund)；[退款请求模型](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/routers.go#L84-L91)

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `pid` | 是 | Client ID |
| `key` | 是 | Client Secret |
| `trade_no` | 是 | 查询接口返回的平台内部数字订单号 |
| `money` | 是 | 必须大于 0、最多 2 位小数，并与原订单金额完全相等 |
| `out_trade_no` | 否 | 兼容字段；当前官方退款实现不使用它定位订单 |

成功响应：

```json
{ "code": 1, "msg": "退款成功" }
```

退款要求订单属于该应用/商户、状态为成功、类型为支付或在线订单且金额完全匹配；否则按“订单不存在或已完成”处理。[官方退款筛选与事务实现](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/routers.go#L244-L297)

必须同时判断 HTTP 状态和 JSON `code`：请求绑定、金额或凭据错误会返回 HTTP `400`；事务内的业务失败可能返回 HTTP `200` 但 `code=-1`。退款请求超时后不能盲目重试并只凭 HTTP 判断结果，应先查询/对账；重复退款不会再次成功，但失败文案不构成稳定的幂等成功响应。[退款响应分支](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/routers.go#L244-L297)

## 9. 错误与响应处理

### 9.1 三种响应协议

| 场景 | 成功 | 失败处理 |
| --- | --- | --- |
| 支付发起 | HTTP `302` + `Location` | `{error_msg,data:null}`，并结合 HTTP 状态 |
| 查询/退款 | `{code:1,msg,...}` | `{code:-1,msg}`；退款业务失败可能仍为 HTTP `200` |
| 商户分发/REST 接口 | `{error_msg:"",data:...}` | `{error_msg:"...",data:null}` |

通用 `{error_msg,data}` 包装由官方服务端统一定义；查询和退款为了兼容易支付而使用独立的 `{code,msg}` 协议。[通用响应定义](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/util/response.go#L19-L45)；[查询/退款响应定义](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/routers.go#L166-L244)

### 9.2 已确认的主要错误

| 错误 | 常见原因 | 商户动作 |
| --- | --- | --- |
| `不支持的请求类型` | `type` 不是 `ldcpay`/`epay`，或请求编码导致服务端读不到 `type` | 检查协议类型和表单编码 |
| `商户未配置公钥` | `ldcpay` 应用没有 Ed25519 公钥 | 上传 32 字节公钥的标准 Base64 |
| `签名格式错误` | Ed25519 `sign` 不是标准 Base64 | 检查编码，不使用 Base64URL |
| `签名验证失败` | 字段、排序、金额规范或密钥不一致 | 记录脱敏的规范串并对照重算 |
| `金额必须大于0` | 金额小于等于 0 | 拒绝创建本地订单 |
| `金额小数位数不能超过2位` | 超过两位小数 | 使用定点小数并在签名前校验 |
| `同一业务订单号的订单信息不一致` | 复用了 `out_trade_no` 但参数不同 | 生成新业务单号或恢复原参数 |
| `订单已过期` / `订单状态不允许支付` | 重放已过期或已完成订单 | 查询本地/平台状态，不重复发起 |
| `订单不存在或已完成` | 查询号错误，或退款目标不满足成功状态等条件 | 对账并转人工处理 |
| `商户信息不存在` | 凭据错误、应用不可用 | 停止重试并告警 |

金额校验和支付错误常量可在官方源码中核对。[金额校验](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/util/validate.go#L43-L51)；[支付错误定义](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/errs.go#L19-L31)

## 10. 官方资料中的不一致与未承诺项

以下差异已在 2026-08-02 以官方仓库当前提交交叉核对：

1. **兼容支付的 `out_trade_no`：** 官方网页参数表写“否”，当前服务端请求模型标记为 `required`。本项目必须按必填处理。[网页表格](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/frontend/components/common/docs/api.tsx#L226-L230)；[服务端模型](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/middlewares.go#L43-L55)
2. **支付发起的 JSON：** 官方网页声明 JSON 和表单都支持；当前路由先通过 `FormValue("type")` 分流，并且两个请求模型只定义 `form` 标签。JSON 请求可能在进入验签前就被判定为不支持的类型，因此本项目只使用表单编码。[网页声明](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/frontend/components/common/docs/api.tsx#L199-L205)；[分流实现](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/middlewares.go#L129-L154)
3. **支付发起方法：** 后端路由同时注册 GET/POST，但公开文档只承诺 POST。不要依赖 GET 发起支付。[后端路由](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/router/router.go#L108-L113)；[公开文档](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/frontend/components/common/docs/api.tsx#L199-L205)
4. **回调重试：** 网页写最多 5 次，当前任务配置为 `MaxRetry(10)`；精确次数不应成为业务逻辑的一部分。[网页说明](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/frontend/components/common/docs/api.tsx#L419-L424)；[任务配置](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/service/payment.go#L244-L258)
5. **回调签名协议：** 公开页面没有明确说明 `ldcpay` 通知的算法；当前 `v1.3.21` 实现仍固定 `type=epay` 并使用 MD5。不要仅根据原生发起使用 Ed25519，就自行改用应用公钥验证通知；必须按稳定源码实现并通过真实联调确认。[官方通知文档](https://credit.linux.do/docs/api#3-3-notify)；[v1.3.21 回调实现](https://github.com/linux-do/credit/blob/v1.3.21/internal/apps/payment/tasks.go#L78-L95)
6. **无稳定错误码目录：** 平台主要返回中文 `error_msg`/`msg`，未发布可依赖的枚举错误码。业务分支应优先使用 HTTP 状态、`code`、本地状态和主动查询，不应只匹配中文文案。[官方 API 文档](https://credit.linux.do/docs/api)

## 11. 其他官方接口

### 11.1 商户分发

`POST https://credit.linux.do/lpay/distribute`，`Content-Type: application/json`，使用 `Authorization: Basic base64(client_id:client_secret)`。字段为必填的 `user_id`、`username`、`amount`，以及可选的 `out_trade_no`、`remark`；成功数据包含 `trade_no` 和 `out_trade_no`。[官方分发文档](https://credit.linux.do/docs/api#3-4-distribute)；[认证与请求实现](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/middlewares.go#L81-L127)；[分发实现](https://github.com/linux-do/credit/blob/f9026267704133be7a700be9e5f702c5dfee471e/internal/apps/payment/routers.go#L299-L438)

### 11.2 用户余额统计

`GET https://credit.linux.do/api/v1/dashboard/stats/user-balance` 是公开、无需鉴权的全平台统计接口，返回用户数、总余额、均值、中位数、最小值、最大值和标准差；它与商城收款闭环无关，不应作为订单余额或支付结果依据。[官方余额统计文档](https://credit.linux.do/docs/api#3-5-user-balance)

## 12. 上线前验收清单

- [ ] 使用测试应用分别完成 `ldcpay` 和当前兼容 `epay` 的签名夹具测试。
- [ ] 固定 `money`、空字段、Unicode 标题、URL 中特殊字符的规范化测试向量。
- [ ] 验证支付发起只使用表单编码，并正确处理 `302 Location`。
- [ ] 验证查询的 `trade_no`、`type`、`status` 语义，不把 `status=0` 当成确定失败。
- [ ] 真实联调确认 `ldcpay` 回调没有 `sign_type`、`type=epay`，并按 v1.3.21 的 MD5 规则验签。
- [ ] 对重复通知、乱序通知、金额篡改、错误签名和处理超时做集成测试。
- [ ] 退款同时判断 HTTP 状态和 `code`，覆盖 HTTP 200 + `code=-1`。
- [ ] 所有日志和监控对 `Client Secret`、私钥、`key` 查询参数、`sign` 做脱敏。
- [ ] 上线前再次核对[官方 API 文档](https://credit.linux.do/docs/api)和[官方仓库](https://github.com/linux-do/credit)，因为页面尚未提供版本化协议或变更日志。
