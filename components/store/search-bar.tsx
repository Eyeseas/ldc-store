"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function buildSearchUrl(params: URLSearchParams): string {
  const queryString = params.toString();
  return queryString ? `/search?${queryString}` : "/search";
}

export function SearchBar({
  placeholder = "搜索商品…",
  autoSubmitOnTyping,
  onAfterSubmit,
  autoFocus,
  className,
}: {
  placeholder?: string;
  autoSubmitOnTyping?: boolean;
  onAfterSubmit?: () => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  const urlQuery = searchParams.get("q") || "";
  const shouldAutoSubmit = autoSubmitOnTyping ?? pathname === "/search";

  const [value, setValue] = useState(urlQuery);
  const [debouncedValue, setDebouncedValue] = useState(urlQuery);

  // URL 改变时同步输入框（例如点击分类/排序筛选）
  useEffect(() => {
    setValue(urlQuery);
    setDebouncedValue(urlQuery);
  }, [urlQuery]);

  // 300ms 防抖
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [value]);

  const normalizedDebounced = useMemo(() => debouncedValue.trim(), [debouncedValue]);

  // 在 /search 页面可选启用：输入即更新 query 参数（防抖后），提升“边输边搜”体验
  useEffect(() => {
    if (!shouldAutoSubmit) return;

    const next = new URLSearchParams(searchParamsString);
    if (normalizedDebounced) {
      next.set("q", normalizedDebounced);
    } else {
      next.delete("q");
    }
    // 关键：变更关键词时重置分页，避免出现“空页”
    next.delete("page");

    router.replace(buildSearchUrl(next), { scroll: false });
  }, [shouldAutoSubmit, normalizedDebounced, router, searchParamsString]);

  const submit = () => {
    const q = value.trim();
    const next = new URLSearchParams(searchParamsString);
    if (q) {
      next.set("q", q);
    } else {
      next.delete("q");
    }
    next.delete("page");

    router.push(buildSearchUrl(next));
    onAfterSubmit?.();
  };

  const clear = () => {
    setValue("");
    setDebouncedValue("");
    const next = new URLSearchParams(searchParamsString);
    next.delete("q");
    next.delete("page");
    router.replace(buildSearchUrl(next), { scroll: false });
  };

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="pl-9 pr-9"
          autoFocus={autoFocus}
          aria-label="搜索商品"
        />
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            onClick={clear}
            aria-label="清空搜索"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </form>
  );
}
