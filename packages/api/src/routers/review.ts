/**
 * راوتر التقييمات. التقييم موثّق: يُسمح به فقط لمن اشترى المنتج فعلاً
 * (طلب وصل أو اكتمل). تقييم واحد لكل (مستخدم، منتج) قابل للتعديل.
 * عند الحفظ تُعاد حسبة تقييم المنتج وتجميع تقييم البائع.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { Prisma } from "@al-souq/db";
import { reviewCreateSchema, storeReviewCreateSchema } from "@al-souq/validators";
import { router, publicProcedure, protectedProcedure } from "../trpc";

export const reviewRouter = router({
  listByProduct: publicProcedure
    .input(z.object({ productId: z.string().cuid(), limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const reviews = await ctx.prisma.review.findMany({
        where: { productId: input.productId, status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: { user: { select: { name: true } } },
      });
      return reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        authorName: r.user.name ?? "مستخدم",
        createdAt: r.createdAt,
      }));
    }),

  // تقييم المستخدم الحالي لهذا المنتج (لعرضه في نموذج التعديل)
  mine: protectedProcedure
    .input(z.object({ productId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const r = await ctx.prisma.review.findFirst({
        where: { userId: ctx.user.id, productId: input.productId },
      });
      return r ? { id: r.id, rating: r.rating, comment: r.comment } : null;
    }),

  upsert: protectedProcedure.input(reviewCreateSchema).mutation(async ({ ctx, input }) => {
    // التحقق من الأهلية: طلب للمستخدم يحوي هذا المنتج وحالته DELIVERED أو COMPLETED
    const eligible = await ctx.prisma.order.findFirst({
      where: {
        customerId: ctx.user.id,
        status: { in: ["DELIVERED", "COMPLETED"] },
        items: { some: { productId: input.productId } },
      },
      select: { id: true },
    });
    if (!eligible) {
      throw new TRPCError({ code: "FORBIDDEN", message: "يمكنك تقييم المنتجات التي استلمتها فقط" });
    }

    await ctx.prisma.$transaction(async (tx) => {
      const existing = await tx.review.findFirst({
        where: { userId: ctx.user.id, productId: input.productId },
      });
      if (existing) {
        await tx.review.update({
          where: { id: existing.id },
          data: { rating: input.rating, comment: input.comment, status: "PUBLISHED" },
        });
      } else {
        await tx.review.create({
          data: {
            userId: ctx.user.id,
            productId: input.productId,
            orderId: eligible.id,
            rating: input.rating,
            comment: input.comment,
            status: "PUBLISHED",
          },
        });
      }
      await recomputeRatings(tx, input.productId);
    });
    return { ok: true };
  }),

  // ── تقييمُ المتجر (تجربة الشراء منه) ──
  listByStore: publicProcedure
    .input(z.object({ vendorId: z.string().cuid(), limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.storeReview.findMany({
        where: { vendorId: input.vendorId, status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: { user: { select: { name: true } } },
      });
      return rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        authorName: r.user.name ?? "مستخدم",
        createdAt: r.createdAt,
      }));
    }),

  /** تقييمي لهذا المتجر + أهليّتي لتقييمه (اشتريتُ منه فعلاً). */
  myStore: protectedProcedure
    .input(z.object({ vendorId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const [mine, eligible] = await Promise.all([
        ctx.prisma.storeReview.findUnique({
          where: { userId_vendorId: { userId: ctx.user.id, vendorId: input.vendorId } },
        }),
        ctx.prisma.order.findFirst({
          where: { customerId: ctx.user.id, vendorId: input.vendorId, status: { in: ["DELIVERED", "COMPLETED"] } },
          select: { id: true },
        }),
      ]);
      return {
        mine: mine ? { id: mine.id, rating: mine.rating, comment: mine.comment } : null,
        canReview: Boolean(eligible),
      };
    }),

  upsertStore: protectedProcedure.input(storeReviewCreateSchema).mutation(async ({ ctx, input }) => {
    // الأهليّة: طلبٌ من هذا المتجر وصل أو اكتمل.
    const eligible = await ctx.prisma.order.findFirst({
      where: { customerId: ctx.user.id, vendorId: input.vendorId, status: { in: ["DELIVERED", "COMPLETED"] } },
      select: { id: true },
    });
    if (!eligible) {
      throw new TRPCError({ code: "FORBIDDEN", message: "يمكنك تقييم المتاجر التي اشتريتَ منها فقط" });
    }
    await ctx.prisma.$transaction(async (tx) => {
      await tx.storeReview.upsert({
        where: { userId_vendorId: { userId: ctx.user.id, vendorId: input.vendorId } },
        update: { rating: input.rating, comment: input.comment, status: "PUBLISHED" },
        create: {
          userId: ctx.user.id,
          vendorId: input.vendorId,
          orderId: eligible.id,
          rating: input.rating,
          comment: input.comment,
          status: "PUBLISHED",
        },
      });
      await recomputeStoreRating(tx, input.vendorId);
    });
    return { ok: true };
  }),
});

/** يعيد حساب تقييم المنتج (تقييمُ المتجر مستقلٌّ عبر StoreReview). */
async function recomputeRatings(tx: Prisma.TransactionClient, productId: string) {
  const agg = await tx.review.aggregate({
    where: { productId, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: true,
  });
  const ratingAvg = new Prisma.Decimal((agg._avg.rating ?? 0).toFixed(2));
  await tx.product.update({
    where: { id: productId },
    data: { ratingAvg, ratingCount: agg._count },
  });
}

/** يعيد حساب تقييم المتجر من تقييمات المتجر (StoreReview). */
async function recomputeStoreRating(tx: Prisma.TransactionClient, vendorId: string) {
  const agg = await tx.storeReview.aggregate({
    where: { vendorId, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: true,
  });
  await tx.vendorProfile.update({
    where: { id: vendorId },
    data: {
      ratingAvg: new Prisma.Decimal((agg._avg.rating ?? 0).toFixed(2)),
      ratingCount: agg._count,
    },
  });
}
