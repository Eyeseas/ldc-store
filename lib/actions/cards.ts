"use server";

import { db, cards, products } from "@/lib/db";
import { eq, and, sql, inArray, desc, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { importCardsSchema, type ImportCardsInput } from "@/lib/validations/card";
import { requireAdmin } from "@/lib/auth-utils";

/**
 * 批量导入卡密
 */
export async function importCards(input: ImportCardsInput) {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "需要管理员权限" };
  }

  const validationResult = importCardsSchema.safeParse(input);
  if (!validationResult.success) {
    return {
      success: false,
      message: validationResult.error.issues[0].message,
    };
  }

  const { productId, content, delimiter } = validationResult.data;

  // 检查商品是否存在
  const product = await db.query.products.findFirst({
    where: eq(products.id, productId),
  });

  if (!product) {
    return { success: false, message: "商品不存在" };
  }

  // 解析卡密内容
  const cardContents = content
    .split(delimiter === "newline" ? /\r?\n/ : ",")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  if (cardContents.length === 0) {
    return { success: false, message: "未找到有效的卡密" };
  }

  // 去重
  const uniqueContents = [...new Set(cardContents)];
  const duplicateCount = cardContents.length - uniqueContents.length;

  // 检查数据库中已存在的卡密
  const existingCards = await db
    .select({ content: cards.content })
    .from(cards)
    .where(
      and(
        eq(cards.productId, productId),
        inArray(cards.content, uniqueContents)
      )
    );

  const existingSet = new Set(existingCards.map((c) => c.content));
  const newContents = uniqueContents.filter((c) => !existingSet.has(c));

  if (newContents.length === 0) {
    return {
      success: false,
      message: "所有卡密都已存在",
      stats: {
        total: cardContents.length,
        duplicateInInput: duplicateCount,
        existingInDb: existingCards.length,
        imported: 0,
      },
    };
  }

  // 批量插入
  try {
    await db.insert(cards).values(
      newContents.map((content) => ({
        productId,
        content,
        status: "available" as const,
      }))
    );

    revalidatePath("/admin/cards");
    revalidatePath("/admin/products");
    revalidatePath("/");

    return {
      success: true,
      message: `成功导入 ${newContents.length} 个卡密`,
      stats: {
        total: cardContents.length,
        duplicateInInput: duplicateCount,
        existingInDb: existingCards.length,
        imported: newContents.length,
      },
    };
  } catch (error) {
    console.error("导入卡密失败:", error);
    return { success: false, message: "导入卡密失败" };
  }
}

/**
 * 获取商品的卡密列表
 */
export async function getCardsByProduct(
  productId: string,
  options?: {
    status?: "available" | "locked" | "sold";
    limit?: number;
    offset?: number;
  }
) {
  const { status, limit = 100, offset = 0 } = options || {};

  const conditions = [eq(cards.productId, productId)];
  if (status) {
    conditions.push(eq(cards.status, status));
  }

  return db.query.cards.findMany({
    where: and(...conditions),
    orderBy: [asc(cards.status), desc(cards.createdAt)],
    limit,
    offset,
  });
}

/**
 * 获取商品库存统计
 */
export async function getCardStats(productId: string) {
  const stats = await db
    .select({
      status: cards.status,
      count: sql<number>`count(*)::int`,
    })
    .from(cards)
    .where(eq(cards.productId, productId))
    .groupBy(cards.status);

  return {
    available: stats.find((s) => s.status === "available")?.count || 0,
    locked: stats.find((s) => s.status === "locked")?.count || 0,
    sold: stats.find((s) => s.status === "sold")?.count || 0,
    total: stats.reduce((sum, s) => sum + s.count, 0),
  };
}

/**
 * 删除卡密
 */
export async function deleteCards(cardIds: string[]) {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "需要管理员权限" };
  }

  if (cardIds.length === 0) {
    return { success: false, message: "请选择要删除的卡密" };
  }

  try {
    // 只能删除未售出的卡密
    const result = await db
      .delete(cards)
      .where(
        and(
          inArray(cards.id, cardIds),
          eq(cards.status, "available")
        )
      )
      .returning({ id: cards.id });

    revalidatePath("/admin/cards");
    revalidatePath("/admin/products");

    return {
      success: true,
      message: `成功删除 ${result.length} 个卡密`,
      deletedCount: result.length,
    };
  } catch (error) {
    console.error("删除卡密失败:", error);
    return { success: false, message: "删除卡密失败" };
  }
}

/**
 * 重置锁定的卡密（释放锁定状态）
 */
export async function resetLockedCards(cardIds: string[]) {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "需要管理员权限" };
  }

  if (cardIds.length === 0) {
    return { success: false, message: "请选择要重置的卡密" };
  }

  try {
    const result = await db
      .update(cards)
      .set({
        status: "available",
        orderId: null,
        lockedAt: null,
      })
      .where(
        and(
          inArray(cards.id, cardIds),
          eq(cards.status, "locked")
        )
      )
      .returning({ id: cards.id });

    revalidatePath("/admin/cards");
    revalidatePath("/admin/products");

    return {
      success: true,
      message: `成功重置 ${result.length} 个卡密`,
      resetCount: result.length,
    };
  } catch (error) {
    console.error("重置卡密失败:", error);
    return { success: false, message: "重置卡密失败" };
  }
}

/**
 * 导出卡密
 */
export async function exportCards(
  productId: string,
  status?: "available" | "sold" | "locked"
) {
  try {
    await requireAdmin();
  } catch {
    return [];
  }

  const conditions = [eq(cards.productId, productId)];
  if (status) {
    conditions.push(eq(cards.status, status));
  }

  const cardList = await db.query.cards.findMany({
    where: and(...conditions),
    columns: {
      content: true,
      status: true,
      createdAt: true,
      soldAt: true,
    },
    orderBy: [desc(cards.createdAt)],
  });

  return cardList;
}

/**
 * 清理重复卡密
 * 保留最早创建的那个
 */
export async function cleanDuplicateCards(productId: string) {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "需要管理员权限" };
  }

  try {
    // 找出重复的卡密
    const duplicates = await db.execute(sql`
      WITH duplicates AS (
        SELECT id, content, 
               ROW_NUMBER() OVER (PARTITION BY content ORDER BY created_at ASC) as rn
        FROM cards 
        WHERE product_id = ${productId} AND status = 'available'
      )
      SELECT id FROM duplicates WHERE rn > 1
    `);

    const duplicateRows = duplicates as unknown as Array<{ id: string }>;
    if (!duplicateRows || duplicateRows.length === 0) {
      return { success: true, message: "没有发现重复卡密", deletedCount: 0 };
    }

    const duplicateIds = duplicateRows.map((row) => row.id);

    await db.delete(cards).where(inArray(cards.id, duplicateIds));

    revalidatePath("/admin/cards");
    revalidatePath("/admin/products");

    return {
      success: true,
      message: `成功清理 ${duplicateIds.length} 个重复卡密`,
      deletedCount: duplicateIds.length,
    };
  } catch (error) {
    console.error("清理重复卡密失败:", error);
    return { success: false, message: "清理失败" };
  }
}

