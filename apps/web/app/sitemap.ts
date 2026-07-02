import type { MetadataRoute } from "next";
import { prisma } from "@al-souq/db";

export const dynamic = "force-dynamic";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://one-theta-81.vercel.app";

/** خريطة الموقع: الصفحات الثابتة + الفئات والمنتجات والمتاجر النشطة. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ملاحظة: صفحات الثقة (about/terms/privacy/…) تُضاف هنا عند إنشائها (المرحلة ٤).
  const staticPages: MetadataRoute.Sitemap = ["", "/stores", "/categories", "/become-seller"].map((p) => ({
    url: `${BASE}${p}`,
    changeFrequency: p === "" ? "daily" : "weekly",
    priority: p === "" ? 1 : 0.5,
  }));

  try {
    const [categories, products, vendors] = await Promise.all([
      prisma.category.findMany({ where: { isActive: true }, select: { slug: true } }),
      prisma.product.findMany({
        where: { status: "ACTIVE", vendor: { status: "APPROVED" } },
        select: { slug: true, updatedAt: true },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      prisma.vendorProfile.findMany({ where: { status: "APPROVED" }, select: { slug: true } }),
    ]);
    return [
      ...staticPages,
      ...categories.map((c) => ({ url: `${BASE}/category/${encodeURIComponent(c.slug)}`, changeFrequency: "daily" as const, priority: 0.7 })),
      ...vendors.map((v) => ({ url: `${BASE}/store/${encodeURIComponent(v.slug)}`, changeFrequency: "daily" as const, priority: 0.6 })),
      ...products.map((p) => ({
        url: `${BASE}/product/${encodeURIComponent(p.slug)}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    // قاعدة البيانات غير متاحة (مثلاً وقت البناء) — نكتفي بالصفحات الثابتة
    return staticPages;
  }
}
