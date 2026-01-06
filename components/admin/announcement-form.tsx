"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Megaphone, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

import {
  createAnnouncement,
  getAnnouncementById,
  updateAnnouncement,
} from "@/lib/actions/announcements";
import {
  announcementSchema,
  type AnnouncementInput,
} from "@/lib/validations/announcement";

function toDateTimeLocalValue(date?: Date | null): string {
  if (!date) return "";
  // datetime-local 需要本地时间字符串；这里选择不带秒，减少噪音。
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function AnnouncementForm({ announcementId }: { announcementId?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(Boolean(announcementId));

  const form = useForm<AnnouncementInput>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: "",
      content: "",
      isActive: true,
      sortOrder: 0,
      startAt: "",
      endAt: "",
    },
  });

  useEffect(() => {
    if (!announcementId) return;
    // TypeScript 不会对被闭包捕获的变量做跨函数的类型收窄；这里先固化 id，
    // 既能满足类型安全，也避免异步请求过程中 announcementId 变化导致读写错位。
    const id = announcementId;

    async function loadAnnouncement() {
      const announcement = await getAnnouncementById(id);
      if (!announcement) {
        toast.error("公告不存在或无权限访问");
        router.push("/admin/announcements");
        return;
      }

      form.reset({
        title: announcement.title,
        content: announcement.content,
        isActive: announcement.isActive,
        sortOrder: announcement.sortOrder,
        startAt: toDateTimeLocalValue(announcement.startAt),
        endAt: toDateTimeLocalValue(announcement.endAt),
      });

      setIsLoading(false);
    }

    loadAnnouncement();
  }, [announcementId, form, router]);

  const onSubmit = (values: AnnouncementInput) => {
    startTransition(async () => {
      const result = announcementId
        ? await updateAnnouncement(announcementId, values)
        : await createAnnouncement(values);

      if (result.success) {
        toast.success(announcementId ? "公告更新成功" : "公告创建成功");
        router.push("/admin/announcements");
      } else {
        toast.error(result.message);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-2 h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-[480px]" />
      </div>
    );
  }

  const isEdit = Boolean(announcementId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/announcements">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {isEdit ? "编辑公告" : "添加公告"}
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            {isEdit ? "修改公告内容与生效时间" : "创建新的首页公告"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Megaphone className="h-5 w-5" />
                    公告内容
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>标题 *</FormLabel>
                        <FormControl>
                          <Input placeholder="输入公告标题" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>内容 (Markdown) *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="支持 Markdown，前台会进行安全渲染（避免 XSS）"
                            rows={10}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">显示设置</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm">启用</FormLabel>
                          <FormDescription>
                            关闭后前台不展示（即使在时间窗口内）
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sortOrder"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>排序</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value, 10) || 0)
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          数字越小越靠前
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-3">
                    <FormField
                      control={form.control}
                      name="startAt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>开始时间</FormLabel>
                          <FormControl>
                            <Input
                              type="datetime-local"
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value)}
                            />
                          </FormControl>
                          <FormDescription>
                            留空表示立即生效（时间按站点时区解释，默认 Asia/Shanghai）
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="endAt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>结束时间</FormLabel>
                          <FormControl>
                            <Input
                              type="datetime-local"
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value)}
                            />
                          </FormControl>
                          <FormDescription>
                            留空表示永不过期（时间按站点时区解释，默认 Asia/Shanghai）
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        保存
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
