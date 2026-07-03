import { describe, it, expect } from "vitest";
import { prisma } from "@al-souq/db";
import { getHomeSections } from "../src/services/discovery";
import { uniquePhone } from "./helpers";

/**
 * يوثّق قرار V1 المقصود: مجموعة المرشّحين = أحدث ٣٠٠ منتج (POOL_SIZE).
 * منتج قديم عالي المبيعات وعالي التقييم — يستحق الظهور منطقياً — لا يُرشَّح
 * إطلاقاً لأنه خارج آخر ٣٠٠. ليس لأن هذا السلوك مثالي، بل لأنه السلوك الحالي
 * المتّفق عليه. وجود الاختبار يجعل القرار مقصوداً: حين نرفع القيد لاحقاً،
 * سيفشل هذا الاختبار عمداً فنراجع القرار بوعي بدل أن يتغيّر بالصدفة.
 */
describe("Candidate pool V1 — أحدث ٣٠٠ (قرار مقصود)", () => {
  it("منتج قديم عالي المبيعات خارج آخر ٣٠٠ لا يظهر في أي قسم", async () => {
    const run = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const gov = await prisma.governorate.findFirstOrThrow();
    const cat = await prisma.category.findFirstOrThrow();
    const user = await prisma.user.create({
      data: { phone: uniquePhone(), role: "VENDOR", name: `مورد ${run}` },
    });
    const vendor = await prisma.vendorProfile.create({
      data: {
        userId: user.id,
        storeName: `متجر المجموعة ${run}`,
        slug: `pool-${run}`,
        slugNorm: `pool-${run}`,
        status: "APPROVED",
        governorateId: gov.id,
        ratingAvg: 5,
        ratingCount: 30,
      },
    });

    try {
      // منتج قديم (٢٠٠ يوم) عالي المبيعات + متوفّر — سيؤهّل لو دخل المجموعة.
      const oldId = `old-${run}`;
      await prisma.product.create({
        data: {
          id: oldId,
          vendorId: vendor.id,
          categoryId: cat.id,
          title: "منتج قديم عالي المبيعات",
          titleNorm: "منتج قديم عالي المبيعات",
          slug: `old-${run}`,
          basePrice: 10000,
          status: "ACTIVE",
          soldCount: 300,
          ratingAvg: 5,
          ratingCount: 20,
          createdAt: new Date(Date.now() - 200 * 86_400_000),
          variants: { create: { price: 10000, stock: 50, isActive: true } },
        },
      });

      // ٣٠٠ منتج أحدث تُزيح القديم خارج مجموعة «أحدث ٣٠٠».
      const now = new Date();
      await prisma.product.createMany({
        data: Array.from({ length: 300 }, (_, i) => ({
          id: `fill-${run}-${i}`,
          vendorId: vendor.id,
          categoryId: cat.id,
          title: `منتج حديث ${i}`,
          titleNorm: `منتج حديث ${i}`,
          slug: `fill-${run}-${i}`,
          basePrice: 5000,
          status: "ACTIVE" as const,
          createdAt: now,
        })),
      });
      await prisma.productVariant.createMany({
        data: Array.from({ length: 300 }, (_, i) => ({
          id: `fillv-${run}-${i}`,
          productId: `fill-${run}-${i}`,
          price: 5000,
          stock: 10,
          isActive: true,
        })),
      });

      const sections = await getHomeSections(prisma, gov.id);
      const productIds = sections
        .filter((s): s is Extract<typeof s, { kind: "products" }> => s.kind === "products")
        .flatMap((s) => s.items.map((it) => it.id));

      // القديم عالي المبيعات غائب — خارج المجموعة رغم استحقاقه.
      expect(productIds).not.toContain(oldId);
      // ومع ذلك بُنيت الأقسام فعلاً — إثبات أن الغياب سببه المجموعة لا فراغها.
      expect(productIds.length).toBeGreaterThan(0);
    } finally {
      // حذف المستخدم يتسلسل إلى المتجر فالمنتجات فالمتغيّرات (onDelete: Cascade).
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
