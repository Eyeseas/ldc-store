"use server";

import { db, categories, products } from "@/lib/db";
import { eq, asc, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@/lib/validations/category";
import { requireAdmin } from "@/lib/auth-utils";

/**
 * 获取所有分类（前台）
 */
export async function getActiveCategories() {
  return db.query.categories.findMany({
    where: eq(categories.isActive, true),
    orderBy: [asc(categories.sortOrder), asc(categories.name)],
  });
}

/**
 * 获取所有分类及商品数量（管理后台）
 */
export async function getAllCategoriesWithCount() {
  const categoryList = await db.query.categories.findMany({
    orderBy: [asc(categories.sortOrder), asc(categories.name)],
  });

  // 获取每个分类的商品数量
  const productCounts = await db
    .select({
      categoryId: products.categoryId,
      count: sql<number>`count(*)::int`,
    })
    .from(products)
    .where(eq(products.isActive, true))
    .groupBy(products.categoryId);

  const countMap = new Map(
    productCounts
      .filter((p) => p.categoryId)
      .map((p) => [p.categoryId, p.count])
  );

  return categoryList.map((category) => ({
    ...category,
    productCount: countMap.get(category.id) || 0,
  }));
}

/**
 * 获取分类详情
 */
export async function getCategoryBySlug(slug: string) {
  return db.query.categories.findFirst({
    where: and(eq(categories.slug, slug), eq(categories.isActive, true)),
  });
}

/**
 * 创建分类
 */
export async function createCategory(input: CreateCategoryInput) {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "需要管理员权限" };
  }

  const validationResult = createCategorySchema.safeParse(input);
  if (!validationResult.success) {
    return {
      success: false,
      message: validationResult.error.issues[0].message,
    };
  }

  try {
    const [category] = await db
      .insert(categories)
      .values(validationResult.data)
      .returning();

    revalidatePath("/admin/categories");
    revalidatePath("/");

    return { success: true, data: category };
  } catch (error) {
    console.error("创建分类失败:", error);
    if (error instanceof Error && error.message.includes("unique")) {
      return { success: false, message: "分类URL标识已存在" };
    }
    return { success: false, message: "创建分类失败" };
  }
}

/**
 * 更新分类
 */
export async function updateCategory(id: string, input: UpdateCategoryInput) {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "需要管理员权限" };
  }

  const validationResult = updateCategorySchema.safeParse(input);
  if (!validationResult.success) {
    return {
      success: false,
      message: validationResult.error.issues[0].message,
    };
  }

  try {
    const [category] = await db
      .update(categories)
      .set({
        ...validationResult.data,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, id))
      .returning();

    if (!category) {
      return { success: false, message: "分类不存在" };
    }

    revalidatePath("/admin/categories");
    revalidatePath("/");

    return { success: true, data: category };
  } catch (error) {
    console.error("更新分类失败:", error);
    if (error instanceof Error && error.message.includes("unique")) {
      return { success: false, message: "分类URL标识已存在" };
    }
    return { success: false, message: "更新分类失败" };
  }
}

/**
 * 删除分类
 */
export async function deleteCategory(id: string) {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "需要管理员权限" };
  }

  try {
    // 检查是否有商品使用该分类
    const productCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.categoryId, id));

    if (productCount[0]?.count > 0) {
      return {
        success: false,
        message: `该分类下还有 ${productCount[0].count} 个商品，无法删除`,
      };
    }

    await db.delete(categories).where(eq(categories.id, id));

    revalidatePath("/admin/categories");
    revalidatePath("/");

    return { success: true, message: "分类已删除" };
  } catch (error) {
    console.error("删除分类失败:", error);
    return { success: false, message: "删除分类失败" };
  }
}

/**
 * 切换分类状态
 */
export async function toggleCategoryActive(id: string) {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "需要管理员权限" };
  }

  try {
    const category = await db.query.categories.findFirst({
      where: eq(categories.id, id),
    });

    if (!category) {
      return { success: false, message: "分类不存在" };
    }

    await db
      .update(categories)
      .set({
        isActive: !category.isActive,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, id));

    revalidatePath("/admin/categories");
    revalidatePath("/");

    return {
      success: true,
      message: category.isActive ? "分类已隐藏" : "分类已显示",
    };
  } catch (error) {
    console.error("切换分类状态失败:", error);
    return { success: false, message: "操作失败" };
  }
}

