"use server";

import { revalidatePath } from "next/cache";

/**
 * 缓存路径定义
 * 集中管理所有需要清理的路径
 */
const CachePaths = {
  // 前台页面
  HOME: "/",
  PRODUCT: (slug: string) => `/product/${slug}`,
  CATEGORY: (slug: string) => `/category/${slug}`,
  SEARCH: "/search",
  
  // 后台页面 (虽然是 force-dynamic，但显式清理更安全)
  ADMIN_PRODUCTS: "/admin/products",
  ADMIN_CARDS: "/admin/cards",
  ADMIN_CATEGORIES: "/admin/categories",
  ADMIN_ORDERS: "/admin/orders",
  ADMIN_ANNOUNCEMENTS: "/admin/announcements",
} as const;

/**
 * 清理商品相关缓存
 * 在商品创建、更新、删除、上下架时调用
 */
export async function revalidateProductCache(productSlug?: string, categorySlug?: string) {
  // 清理首页缓存（商品列表）
  revalidatePath(CachePaths.HOME);
  
  // 清理具体商品页面缓存
  if (productSlug) {
    revalidatePath(CachePaths.PRODUCT(productSlug));
  }
  
  // 清理分类页面缓存（商品可能属于某个分类）
  if (categorySlug) {
    revalidatePath(CachePaths.CATEGORY(categorySlug));
  }
  
  // 清理后台商品页面
  revalidatePath(CachePaths.ADMIN_PRODUCTS);
}

/**
 * 清理卡密相关缓存
 * 在卡密导入、删除、重置时调用
 */
export async function revalidateCardCache() {
  // 清理首页缓存（库存数量会变化）
  revalidatePath(CachePaths.HOME);
  
  // 清理后台页面
  revalidatePath(CachePaths.ADMIN_CARDS);
  revalidatePath(CachePaths.ADMIN_PRODUCTS);
}

/**
 * 清理分类相关缓存
 * 在分类创建、更新、删除、切换状态时调用
 */
export async function revalidateCategoryCache(categorySlug?: string) {
  // 清理首页缓存（分类导航）
  revalidatePath(CachePaths.HOME);
  
  // 清理具体分类页面
  if (categorySlug) {
    revalidatePath(CachePaths.CATEGORY(categorySlug));
  }
  
  // 清理后台分类页面
  revalidatePath(CachePaths.ADMIN_CATEGORIES);
}

/**
 * 清理订单相关缓存
 * 在订单状态变化时调用
 */
export async function revalidateOrderCache() {
  // 清理后台订单页面
  revalidatePath(CachePaths.ADMIN_ORDERS);
}

/**
 * 清理公告相关缓存
 * 公告影响前台首页（Banner）与后台公告管理页
 */
export async function revalidateAnnouncementCache() {
  revalidatePath(CachePaths.HOME);
  revalidatePath(CachePaths.ADMIN_ANNOUNCEMENTS);
}

/**
 * 清理所有商店前台缓存
 * 用于批量操作或需要完全刷新的场景
 */
export async function revalidateAllStoreCache() {
  revalidatePath(CachePaths.HOME);
  // 使用 layout 路径可以清理该 layout 下的所有页面
  revalidatePath("/(store)", "layout");
  revalidatePath(CachePaths.SEARCH);
}

/**
 * 清理特定商品及其关联分类的缓存
 * 综合清理函数，用于商品操作
 */
export async function revalidateProductAndRelatedCache(
  productSlug?: string,
  categorySlug?: string
) {
  await revalidateProductCache(productSlug, categorySlug);
  
  // 如果有分类，也清理分类页
  if (categorySlug) {
    revalidatePath(CachePaths.CATEGORY(categorySlug));
  }
}
