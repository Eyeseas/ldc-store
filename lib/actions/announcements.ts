"use server";

import { db, announcements } from "@/lib/db";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-utils";
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  type CreateAnnouncementInput,
  type UpdateAnnouncementInput,
} from "@/lib/validations/announcement";
import { revalidateAnnouncementCache } from "@/lib/cache";

const SITE_TIMEZONE = process.env.STATS_TIMEZONE || "Asia/Shanghai";

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  // 通过 Intl 将指定时区的“当地时间”格式化后反推为 UTC 时间戳，
  // 与原始 date.getTime() 的差值即为该时区在该时刻的 offset（可覆盖 DST 场景）
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") {
      map[p.type] = p.value;
    }
  }

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );

  return asUtc - date.getTime();
}

function parseDateTimeLocal(value: string): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, y, m, d, hh, mm] = match;

  // datetime-local 不含时区，浏览器通常按“用户本地时区”理解；
  // 服务端处理时应显式按站点时区解释，避免部署在 UTC 等环境导致定时偏移。
  const guess = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), 0));

  try {
    const offset1 = getTimeZoneOffsetMs(guess, SITE_TIMEZONE);
    const adjusted = new Date(guess.getTime() - offset1);
    const offset2 = getTimeZoneOffsetMs(adjusted, SITE_TIMEZONE);
    return offset2 === offset1 ? adjusted : new Date(guess.getTime() - offset2);
  } catch {
    // timeZone 非法或 Intl 不支持时，回退为默认解析（可能依赖服务器时区）
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
}

/**
 * 获取当前有效公告（前台）
 * - isActive=true
 * - startAt/endAt 为空表示不限制
 */
export async function getActiveAnnouncements() {
  const now = new Date();

  return db.query.announcements.findMany({
    where: and(
      eq(announcements.isActive, true),
      or(isNull(announcements.startAt), lte(announcements.startAt, now))!,
      or(isNull(announcements.endAt), gte(announcements.endAt, now))!
    ),
    orderBy: [asc(announcements.sortOrder), desc(announcements.createdAt)],
  });
}

/**
 * 获取所有公告（管理后台）
 */
export async function getAllAnnouncements(options?: {
  limit?: number;
  offset?: number;
  status?: "all" | "active" | "inactive";
}) {
  try {
    await requireAdmin();
  } catch {
    return { items: [], total: 0 };
  }

  const { limit = 50, offset = 0, status = "all" } = options || {};

  const conditions =
    status === "all"
      ? undefined
      : eq(announcements.isActive, status === "active");

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(announcements)
    .where(conditions);

  const items = await db.query.announcements.findMany({
    where: conditions,
    orderBy: [asc(announcements.sortOrder), desc(announcements.createdAt)],
    limit,
    offset,
  });

  return { items, total: count ?? 0 };
}

/**
 * 获取公告详情（管理后台）
 */
export async function getAnnouncementById(id: string) {
  try {
    await requireAdmin();
  } catch {
    return null;
  }

  return db.query.announcements.findFirst({
    where: eq(announcements.id, id),
  });
}

/**
 * 创建公告
 */
export async function createAnnouncement(input: CreateAnnouncementInput) {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "需要管理员权限" };
  }

  const validationResult = createAnnouncementSchema.safeParse(input);
  if (!validationResult.success) {
    return { success: false, message: validationResult.error.issues[0].message };
  }

  const startAt = parseDateTimeLocal(validationResult.data.startAt);
  const endAt = parseDateTimeLocal(validationResult.data.endAt);

  try {
    const [created] = await db
      .insert(announcements)
      .values({
        title: validationResult.data.title,
        content: validationResult.data.content,
        isActive: validationResult.data.isActive,
        sortOrder: validationResult.data.sortOrder,
        startAt,
        endAt,
      })
      .returning();

    await revalidateAnnouncementCache();

    return { success: true, data: created };
  } catch (error) {
    console.error("创建公告失败:", error);
    return { success: false, message: "创建公告失败" };
  }
}

/**
 * 更新公告
 */
export async function updateAnnouncement(id: string, input: UpdateAnnouncementInput) {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "需要管理员权限" };
  }

  const validationResult = updateAnnouncementSchema.safeParse(input);
  if (!validationResult.success) {
    return { success: false, message: validationResult.error.issues[0].message };
  }

  const startAt = parseDateTimeLocal(validationResult.data.startAt);
  const endAt = parseDateTimeLocal(validationResult.data.endAt);

  try {
    const [updated] = await db
      .update(announcements)
      .set({
        title: validationResult.data.title,
        content: validationResult.data.content,
        isActive: validationResult.data.isActive,
        sortOrder: validationResult.data.sortOrder,
        startAt,
        endAt,
        updatedAt: new Date(),
      })
      .where(eq(announcements.id, id))
      .returning();

    if (!updated) {
      return { success: false, message: "公告不存在" };
    }

    await revalidateAnnouncementCache();

    return { success: true, data: updated };
  } catch (error) {
    console.error("更新公告失败:", error);
    return { success: false, message: "更新公告失败" };
  }
}

/**
 * 删除公告
 */
export async function deleteAnnouncement(id: string) {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "需要管理员权限" };
  }

  try {
    await db.delete(announcements).where(eq(announcements.id, id));
    await revalidateAnnouncementCache();
    return { success: true, message: "公告已删除" };
  } catch (error) {
    console.error("删除公告失败:", error);
    return { success: false, message: "删除公告失败" };
  }
}

/**
 * 切换公告状态（启用/停用）
 */
export async function toggleAnnouncementStatus(id: string) {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "需要管理员权限" };
  }

  try {
    const announcement = await db.query.announcements.findFirst({
      where: eq(announcements.id, id),
    });

    if (!announcement) {
      return { success: false, message: "公告不存在" };
    }

    await db
      .update(announcements)
      .set({ isActive: !announcement.isActive, updatedAt: new Date() })
      .where(eq(announcements.id, id));

    await revalidateAnnouncementCache();

    return {
      success: true,
      message: announcement.isActive ? "公告已停用" : "公告已启用",
    };
  } catch (error) {
    console.error("切换公告状态失败:", error);
    return { success: false, message: "操作失败" };
  }
}
