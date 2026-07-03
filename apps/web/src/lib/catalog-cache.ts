import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@al-souq/db";
import type { ProductCardData } from "@/src/components/product-card";

/**
 * طبقة كاش لاستعلامات الكتالوج الأكثر طلباً — تقلّل ضربات قاعدة البيانات بشدّة
 * عند النمو. الصفحات تبقى ديناميكية (تقرأ كوكي المحافظة)، لكن البيانات تُخدَم
 * من الكاش. المفتاح يتضمّن معرّف المحافظة للحفاظ على عزل الأسواق.
 *
 * الفئات شبه ثابتة → صلاحية أطول (٥ دقائق). قوائم المنتجات → صلاحية قصيرة (دقيقة).
 */

export type CachedCategory = {
  id: string;
  nameAr: string;
  slug: string;
  icon: string | null;
  children: { id: string; nameAr: string; slug: string }[];
};

export const getCachedCategories = unstable_cache(
  async (): Promise<CachedCategory[]> =>
    prisma.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        nameAr: true,
        slug: true,
        icon: true,
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, nameAr: true, slug: true },
        },
      },
    }),
  ["catalog:categories"],
  { revalidate: 300, tags: ["categories"] },
);

/** أحدث المنتجات للصفحة الرئيسية، مُخزَّنة مؤقتاً لكل محافظة. */
export function getCachedHomeProducts(governorateId?: string): Promise<ProductCardData[]> {
  const key = governorateId ?? "all";
  return unstable_cache(
    async (): Promise<ProductCardData[]> => {
      const items = await prisma.product.findMany({
        where: {
          status: "ACTIVE",
          vendor: { status: "APPROVED", ...(governorateId ? { governorateId } : {}) },
        },
        orderBy: { createdAt: "desc" },
        take: 24,
        select: {
          id: true,
          title: true,
          slug: true,
          basePrice: true,
          ratingAvg: true,
          ratingCount: true,
          images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
          vendor: { select: { storeName: true, slug: true } },
        },
      });
      return items.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        price: Number(p.basePrice),
        ratingAvg: Number(p.ratingAvg),
        ratingCount: p.ratingCount,
        image: p.images[0]?.url ?? null,
        vendor: { storeName: p.vendor.storeName, slug: p.vendor.slug },
      }));
    },
    ["catalog:home-products", key],
    { revalidate: 60, tags: ["products"] },
  )();
}
