"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, Lock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

const loginSchema = z.object({
  password: z.string().min(1, "请输入密码"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// 检查是否启用了 Linux DO OAuth2 登录
const LINUXDO_ENABLED = process.env.NEXT_PUBLIC_LINUXDO_ENABLED === "true";

function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        password: values.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("登录失败", {
          description: "密码错误",
        });
      } else {
        toast.success("登录成功");
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      toast.error("登录失败", {
        description: "发生未知错误",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinuxDoLogin = async () => {
    setIsOAuthLoading(true);
    try {
      await signIn("linux-do", { callbackUrl });
    } catch {
      toast.error("登录失败", {
        description: "OAuth 登录发生错误",
      });
      setIsOAuthLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600">
          <Lock className="h-7 w-7 text-white" />
        </div>
        <CardTitle className="text-xl">管理员登录</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>管理密码</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="输入管理密码"
                      className="h-11"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full h-11"
              disabled={isLoading || isOAuthLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  登录中...
                </>
              ) : (
                "登录"
              )}
            </Button>
          </form>
        </Form>

        {LINUXDO_ENABLED && (
          <>
            <div className="relative my-4">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                或
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-11"
              disabled={isLoading || isOAuthLoading}
              onClick={handleLinuxDoLogin}
            >
              {isOAuthLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  跳转中...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  使用 Linux DO 账号登录
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LoginFormFallback() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600">
          <Lock className="h-7 w-7 text-white" />
        </div>
        <CardTitle className="text-xl">管理员登录</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="h-11 rounded-md bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          <div className="h-11 rounded-md bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 p-4 dark:from-zinc-950 dark:to-zinc-900">
      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
