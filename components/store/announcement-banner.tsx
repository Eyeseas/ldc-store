"use client";

import { useMemo, useState } from "react";
import { Megaphone, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface AnnouncementBannerItem {
  id: string;
  title: string;
  contentHtml?: string;
  updatedAt?: string;
}

const DISMISS_KEY = "ldc-store:announcement-banner:dismissed-signature";

export function AnnouncementBanner({
  announcements,
}: {
  announcements: AnnouncementBannerItem[];
}) {
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY);
    } catch {
      // localStorage 不可用时返回 null，避免把公告“误隐藏”
      return null;
    }
  });
  const [activeIndex, setActiveIndex] = useState(0);

  const signature = useMemo(() => {
    return announcements
      .map((a) => `${a.id}:${a.updatedAt ?? ""}`)
      .join("|");
  }, [announcements]);

  const dismissed = dismissedSignature === signature;

  if (announcements.length === 0 || dismissed) {
    return null;
  }

  const safeIndex = activeIndex % announcements.length;
  const active = announcements[safeIndex];
  const hasMultiple = announcements.length > 1;
  const canShowDetails = typeof active.contentHtml === "string" && active.contentHtml.length > 0;

  const goPrev = () =>
    setActiveIndex((idx) => (idx - 1 + announcements.length) % announcements.length);
  const goNext = () => setActiveIndex((idx) => (idx + 1) % announcements.length);

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, signature);
    } catch {
      // 忽略：保持当前会话关闭即可
    }
    setDismissedSignature(signature);
  };

  return (
    <div className="mb-6 rounded-xl border bg-muted/30 px-3 py-2">
      <div className="flex items-start gap-2">
        <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {active.title}
            </span>

            {canShowDetails ? (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="link" className="h-auto p-0 text-xs">
                    查看详情
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader>
                    <DialogTitle>{active.title}</DialogTitle>
                  </DialogHeader>
                  <div
                    className="prose prose-sm prose-zinc max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: active.contentHtml! }}
                  />
                </DialogContent>
              </Dialog>
            ) : null}
          </div>

          {hasMultiple ? (
            <div className="mt-2 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={goPrev}
                aria-label="上一条公告"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1">
                {announcements.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${
                      idx === safeIndex ? "bg-foreground" : "bg-muted-foreground/40"
                    }`}
                    aria-label={`切换到第 ${idx + 1} 条公告`}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={goNext}
                aria-label="下一条公告"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="ml-1 text-xs text-muted-foreground">
                {safeIndex + 1}/{announcements.length}
              </span>
            </div>
          ) : null}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleDismiss}
          aria-label="关闭公告"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
