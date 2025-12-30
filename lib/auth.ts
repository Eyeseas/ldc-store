import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

const loginSchema = z.object({
  password: z.string().min(1),
});

// Linux DO OAuth2 Provider 配置
// 文档: https://connect.linux.do
const LinuxDoProvider = {
  id: "linux-do",
  name: "Linux DO",
  type: "oauth" as const,
  authorization: {
    url: process.env.LINUXDO_AUTHORIZATION_URL || "https://connect.linux.do/oauth2/authorize",
    params: { scope: "user" },
  },
  token: {
    url: process.env.LINUXDO_TOKEN_URL || "https://connect.linux.do/oauth2/token",
  },
  userinfo: {
    url: process.env.LINUXDO_USERINFO_URL || "https://connect.linux.do/api/user",
  },
  clientId: process.env.LINUXDO_CLIENT_ID,
  clientSecret: process.env.LINUXDO_CLIENT_SECRET,
  // 用户信息字段参考文档:
  // id - 用户唯一标识（不可变）
  // username - 论坛用户名
  // name - 论坛用户昵称（可变）
  // avatar_template - 用户头像模板URL（支持多种尺寸）
  // active - 账号活跃状态
  // trust_level - 信任等级（0-4）
  // silenced - 禁言状态
  // external_ids - 外部ID关联信息
  profile(profile: {
    id: number;
    username: string;
    name?: string;
    avatar_template?: string;
    active?: boolean;
    trust_level?: number;
    silenced?: boolean;
  }) {
    // 处理头像URL模板，替换 {size} 为实际尺寸
    const avatarUrl = profile.avatar_template
      ? profile.avatar_template.replace("{size}", "120")
      : undefined;
    
    return {
      id: String(profile.id),
      name: profile.name || profile.username,
      email: `${profile.username}@linux.do`, // Linux DO 不返回邮箱，使用用户名构造
      image: avatarUrl,
      username: profile.username,
      trustLevel: profile.trust_level,
      active: profile.active,
      silenced: profile.silenced,
    };
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    // Linux DO OAuth2 登录（仅在配置了相关环境变量时启用）
    ...(process.env.LINUXDO_CLIENT_ID && process.env.LINUXDO_CLIENT_SECRET
      ? [LinuxDoProvider]
      : []),
    // 管理员密码登录
    Credentials({
      name: "credentials",
      credentials: {
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { password } = parsed.data;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword) {
          console.error("ADMIN_PASSWORD 环境变量未设置");
          return null;
        }

        // 直接比较密码（明文）
        if (password !== adminPassword) {
          return null;
        }

        // 返回固定的管理员用户
        return {
          id: "admin",
          email: "admin@localhost",
          name: "管理员",
          role: "admin",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        // 保存 OAuth 用户的额外信息
        if (account?.provider === "linux-do") {
          token.username = (user as { username?: string }).username;
          token.trustLevel = (user as { trustLevel?: number }).trustLevel;
          token.active = (user as { active?: boolean }).active;
          token.silenced = (user as { silenced?: boolean }).silenced;
          token.provider = "linux-do";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        // 传递 OAuth 用户信息到 session
        (session.user as { username?: string }).username = token.username as string;
        (session.user as { trustLevel?: number }).trustLevel = token.trustLevel as number;
        (session.user as { active?: boolean }).active = token.active as boolean;
        (session.user as { silenced?: boolean }).silenced = token.silenced as boolean;
        (session.user as { provider?: string }).provider = token.provider as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
  },
});

