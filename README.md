# LDC Store - 自动发卡系统

基于 Next.js 16 的虚拟商品自动发卡平台，支持 Linux DO Credit 积分支付。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR_USERNAME%2Fldc-store&env=DATABASE_URL,AUTH_SECRET,LDC_PID,LDC_SECRET&envDescription=Required%20environment%20variables&envLink=https%3A%2F%2Fgithub.com%2FYOUR_USERNAME%2Fldc-store%23environment-variables&project-name=ldc-store&repository-name=ldc-store)

## ✨ 特性

- 🛒 **前台商店** - 商品展示、分类导航、搜索功能
- 🔐 **游客购买** - 无需注册，邮箱 + 查询密码即可下单
- 💳 **自动发卡** - 支付成功后自动发放卡密
- 📦 **库存管理** - 批量导入卡密、去重检测、库存预警
- 📊 **后台管理** - 商品/订单/分类/卡密全方位管理
- 🎨 **现代 UI** - 基于 Shadcn/UI，支持深色模式

## 🛠️ 技术栈

- **Framework:** Next.js 16 (App Router, Server Actions)
- **Language:** TypeScript
- **Database:** PostgreSQL (推荐 Neon/Supabase)
- **ORM:** Drizzle ORM
- **UI:** Shadcn/UI + Tailwind CSS
- **Auth:** NextAuth.js v5
- **Payment:** Linux DO Credit

## 🚀 一键部署到 Vercel

1. 点击上方 "Deploy with Vercel" 按钮
2. 在 Vercel 中配置环境变量
3. 等待部署完成
4. 运行数据库迁移初始化

## 📦 本地开发

### 1. 克隆项目

```bash
git clone https://github.com/YOUR_USERNAME/ldc-store.git
cd ldc-store
pnpm install
```

### 2. 配置环境变量

复制环境变量样例文件并修改：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填写实际配置值：

```env
# 数据库 (推荐 Neon: https://neon.tech)
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"

# NextAuth 密钥 (生成: openssl rand -base64 32)
AUTH_SECRET="your-auth-secret"
AUTH_TRUST_HOST=true

# 管理员密码
ADMIN_PASSWORD="your-admin-password"

# Linux DO Credit 支付
LDC_PID="your_client_id"
LDC_SECRET="your_client_secret"
LDC_GATEWAY="https://credit.linux.do/epay"

# Linux DO OAuth2 登录（可选）
LINUXDO_CLIENT_ID="your_linuxdo_client_id"
LINUXDO_CLIENT_SECRET="your_linuxdo_client_secret"

# 网站名称（可选，显示在 Header 标题和页面标题中）
NEXT_PUBLIC_SITE_NAME="LDC Store"

# 网站描述（可选）
NEXT_PUBLIC_SITE_DESCRIPTION="基于 Linux DO Credit 的虚拟商品自动发卡平台"

# 订单过期时间（分钟）
ORDER_EXPIRE_MINUTES=30
```

### 3. 初始化数据库

```bash
# 推送表结构到数据库
pnpm db:push

# 初始化示例数据（可选）
pnpm db:seed
```

### 4. 启动开发服务器

```bash
pnpm dev
```

访问:
- 前台商店: http://localhost:3000
- 后台管理: http://localhost:3000/admin

### 管理员登录

访问 `/admin` 输入 `ADMIN_PASSWORD` 环境变量中设置的密码即可登录。

## 🔧 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 连接字符串 |
| `AUTH_SECRET` | ✅ | NextAuth 加密密钥 |
| `ADMIN_PASSWORD` | ✅ | 管理员登录密码 |
| `LDC_PID` | ⚠️ | Linux DO Credit Client ID |
| `LDC_SECRET` | ⚠️ | Linux DO Credit Secret |
| `LDC_GATEWAY` | ❌ | 支付网关地址（默认官方地址）|
| `LINUXDO_CLIENT_ID` | ❌ | Linux DO OAuth2 Client ID |
| `LINUXDO_CLIENT_SECRET` | ❌ | Linux DO OAuth2 Client Secret |
| `NEXT_PUBLIC_LINUXDO_ENABLED` | ❌ | 是否在登录页显示 OAuth 按钮（设置为 "true" 启用）|
| `LINUXDO_AUTHORIZATION_URL` | ❌ | OAuth2 授权端点（默认官方地址）|
| `LINUXDO_TOKEN_URL` | ❌ | OAuth2 Token 端点（默认官方地址）|
| `LINUXDO_USERINFO_URL` | ❌ | OAuth2 用户信息端点（默认官方地址）|
| `NEXT_PUBLIC_SITE_NAME` | ❌ | 网站名称（显示在 Header 标题和页面标题中）|
| `NEXT_PUBLIC_SITE_DESCRIPTION` | ❌ | 网站描述（用于 SEO meta 标签）|
| `ORDER_EXPIRE_MINUTES` | ❌ | 订单过期时间（默认30分钟）|

## 📝 Linux DO Credit 配置

1. 访问 [Linux DO Credit 控制台](https://credit.linux.do)
2. 创建新应用，获取 `pid` 和 `key`
3. 配置回调地址:
   - **Notify URL:** `https://your-domain.com/api/payment/notify`
   - **Return URL:** `https://your-domain.com/order/result`

## 🔑 Linux DO OAuth2 登录配置

支持用户使用 Linux DO 账号登录，获取用户信息。

### 申请接入

1. 访问 [Linux DO Connect](https://connect.linux.do) 控制台
2. 点击 **我的应用接入** - **申请新接入**
3. 填写应用信息，**回调地址** 填写：`https://your-domain.com/api/auth/callback/linux-do`
4. 申请成功后获取 `Client ID` 和 `Client Secret`

### 环境变量配置

在 `.env` 中配置:

```env
LINUXDO_CLIENT_ID="your_client_id"
LINUXDO_CLIENT_SECRET="your_client_secret"
NEXT_PUBLIC_LINUXDO_ENABLED="true"
```

### 可获取的用户信息

| 字段 | 说明 |
|------|------|
| `id` | 用户唯一标识（不可变） |
| `username` | 论坛用户名 |
| `name` | 论坛用户昵称（可变） |
| `avatar_template` | 用户头像模板URL（支持多种尺寸） |
| `active` | 账号活跃状态 |
| `trust_level` | 信任等级（0-4） |
| `silenced` | 禁言状态 |

### OAuth2 端点（默认值，一般无需修改）

| 端点 | 地址 |
|------|------|
| 授权端点 | `https://connect.linux.do/oauth2/authorize` |
| Token 端点 | `https://connect.linux.do/oauth2/token` |
| 用户信息端点 | `https://connect.linux.do/api/user` |

如需自定义端点地址，可配置以下环境变量：
- `LINUXDO_AUTHORIZATION_URL`
- `LINUXDO_TOKEN_URL`
- `LINUXDO_USERINFO_URL`

## 📁 项目结构

```
ldc-store/
├── app/
│   ├── (store)/          # 前台商店
│   ├── (admin)/          # 后台管理
│   └── api/              # API 路由
├── components/
│   ├── ui/               # Shadcn UI
│   ├── store/            # 前台组件
│   └── admin/            # 后台组件
├── lib/
│   ├── db/               # 数据库配置
│   ├── actions/          # Server Actions
│   ├── payment/          # 支付集成
│   └── validations/      # Zod 验证
└── ...
```

## 🗃️ 数据库命令

```bash
# 生成迁移文件
pnpm db:generate

# 推送表结构（开发环境）
pnpm db:push

# 运行迁移（生产环境）
pnpm db:migrate

# 打开数据库可视化工具
pnpm db:studio

# 初始化种子数据
pnpm db:seed

# 重置数据库（危险！）
pnpm db:reset
```

## 📄 License

MIT
