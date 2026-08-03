const fs = require('fs');

const content = `# ============================================
# LDC Store 环境变量配置
# ============================================
# 复制此文件为 .env 并填写实际值
# cp .env.example .env

# ============================================
# 数据库配置 (必填)
# ============================================
# PostgreSQL 数据库连接字符串
# 推荐使用 Neon (https://neon.tech) 或 Supabase (https://supabase.com)
# 格式: postgresql://user:password@host/database?sslmode=require
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"

# ============================================
# 认证配置 (必填)
# ============================================
# NextAuth 加密密钥 (生成命令: openssl rand -base64 32)
AUTH_SECRET="your-auth-secret-key-here"

# 信任主机 (Vercel 部署必须设置为 true)
AUTH_TRUST_HOST=true

# 管理员登录密码
ADMIN_PASSWORD="your-secure-admin-password"

# 管理员用户名白名单 (可选)
# 允许通过 Linux DO OAuth 登录后台的用户名列表，逗号分隔
# 留空则只能使用密码登录后台
ADMIN_USERNAMES=""

# ============================================
# Linux DO Credit 支付配置 (必填)
# ============================================
# 在 https://credit.linux.do 创建应用后获取
LDC_CLIENT_ID="your_client_id"
LDC_CLIENT_SECRET="your_client_secret"

# 支付协议: epay (默认) / ldcpay (原生 Ed25519)
LDC_PAYMENT_PROTOCOL="epay"
# ldcpay 模式必填，运行 pnpm ldc:keygen 生成
# LDC_ED25519_PRIVATE_KEY_PKCS8_BASE64="your_pkcs8_private_key_base64"

# 支付网关地址 (一般无需修改)
LDC_GATEWAY="https://credit.linux.do/epay"

# 退款模式: server / proxy / disabled (默认)
LDC_REFUND_MODE="disabled"
# proxy 模式必须配置可信 HTTPS 地址
# LDC_PROXY_URL="https://your-proxy-domain.com/api.php"

# ============================================
# Linux DO OAuth2 登录配置 (必填)
# ============================================
# 在 https://connect.linux.do 申请应用后获取
# 用户必须使用 Linux DO 账号登录才能下单
LINUXDO_CLIENT_ID="your_linuxdo_client_id"
LINUXDO_CLIENT_SECRET="your_linuxdo_client_secret"

# OAuth2 端点 (一般无需修改，使用默认值即可)
# LINUXDO_AUTHORIZATION_URL="https://connect.linux.do/oauth2/authorize"
# LINUXDO_TOKEN_URL="https://connect.linux.do/oauth2/token"
# LINUXDO_USERINFO_URL="https://connect.linux.do/api/user"

# ============================================
# 网站配置 (可选)
# ============================================
# 网站名称 (显示在 Header 和浏览器标题)
NEXT_PUBLIC_SITE_NAME="LDC Store"

# 网站描述 (用于 SEO)
NEXT_PUBLIC_SITE_DESCRIPTION="基于 Linux DO Credit 的虚拟商品自动发卡平台"

# ============================================
# 订单配置 (可选)
# ============================================
# 订单过期时间 (分钟)，默认 10 分钟
ORDER_EXPIRE_MINUTES=10
`;

fs.writeFileSync('.env.example', content, 'utf8');
console.log('.env.example updated successfully!');
