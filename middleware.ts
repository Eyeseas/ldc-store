import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const startTime = Date.now();
  const { pathname } = req.nextUrl;
  const user = req.auth?.user as { role?: string } | undefined;
  const isAdmin = user?.role === "admin";

  // 生成/透传 requestId，便于将 middleware / Route Handler / Server Actions 的日志关联起来
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);

  const log = (level: "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) => {
    // Edge runtime 下不引入 pino，使用 JSON 结构化输出，便于后续接入日志平台
    const payload = {
      level,
      msg: message,
      requestId,
      method: req.method,
      path: pathname,
      durationMs: Date.now() - startTime,
      ...extra,
      ts: new Date().toISOString(),
    };
    // eslint-disable-next-line no-console
    console[level](JSON.stringify(payload));
  };

  // 保护 /admin 路由（登录页除外）
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!req.auth || !isAdmin) {
      const loginUrl = new URL("/admin/login", req.nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", pathname);
      const response = NextResponse.redirect(loginUrl);
      response.headers.set("x-request-id", requestId);
      log("warn", "admin access denied");
      return response;
    }
  }

  // 已登录的管理员访问登录页时重定向到后台首页
  if (pathname === "/admin/login" && req.auth && isAdmin) {
    const response = NextResponse.redirect(new URL("/admin", req.nextUrl.origin));
    response.headers.set("x-request-id", requestId);
    log("info", "admin already logged in, redirect to /admin");
    return response;
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("x-request-id", requestId);
  log("info", "request");
  return response;
});

export const config = {
  matcher: ["/admin/:path*"],
};
