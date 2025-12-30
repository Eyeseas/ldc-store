"use server";

import { auth } from "@/lib/auth";

export interface AdminSession {
  user: {
    id: string;
    role: "admin";
    name?: string;
    email?: string;
  };
}

/**
 * 验证当前用户是否为管理员
 * 如果不是管理员，抛出错误
 * 
 * 用于保护所有管理员操作的 Server Actions
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; name?: string; email?: string } | undefined;

  if (!user?.id) {
    throw new Error("未登录");
  }

  if (user.role !== "admin") {
    throw new Error("需要管理员权限");
  }

  return {
    user: {
      id: user.id,
      role: "admin",
      name: user.name,
      email: user.email,
    },
  };
}

/**
 * 检查当前用户是否为管理员（不抛出错误）
 * 返回 boolean 值
 */
export async function isAdmin(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

