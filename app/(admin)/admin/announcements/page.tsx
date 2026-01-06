export const dynamic = "force-dynamic";

import Link from "next/link";
import { format } from "date-fns";
import { Megaphone, Plus, CalendarClock, Eye, EyeOff } from "lucide-react";

import { getAllAnnouncements } from "@/lib/actions/announcements";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnnouncementActions } from "./announcement-actions";

function formatTimeRange(startAt?: Date | null, endAt?: Date | null): string {
  if (!startAt && !endAt) return "长期";
  const start = startAt ? format(startAt, "yyyy-MM-dd HH:mm") : "立即";
  const end = endAt ? format(endAt, "yyyy-MM-dd HH:mm") : "永不过期";
  return `${start} → ${end}`;
}

export default async function AnnouncementsPage() {
  const { items } = await getAllAnnouncements({ limit: 100, offset: 0, status: "all" });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            公告管理
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            管理首页公告的内容、排序与定时上下线
          </p>
        </div>
        <Link href="/admin/announcements/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            添加公告
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-5 w-5" />
            公告列表 ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>标题</TableHead>
                    <TableHead className="text-center">状态</TableHead>
                    <TableHead>生效时间</TableHead>
                    <TableHead className="text-center">排序</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="min-w-64">
                        <div className="space-y-1">
                          <p className="font-medium text-zinc-900 dark:text-zinc-50">
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {item.content}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.isActive ? (
                          <Badge className="bg-emerald-100 text-emerald-700">
                            <Eye className="mr-1 h-3 w-3" />
                            启用
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <EyeOff className="mr-1 h-3 w-3" />
                            停用
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarClock className="h-4 w-4" />
                          <span>{formatTimeRange(item.startAt, item.endAt)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{item.sortOrder}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <AnnouncementActions
                          announcementId={item.id}
                          isActive={item.isActive}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <Megaphone className="mx-auto h-12 w-12 text-zinc-300" />
              <p className="mt-4 text-zinc-500">暂无公告</p>
              <Link href="/admin/announcements/new" className="mt-4 inline-block">
                <Button>创建第一条公告</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

