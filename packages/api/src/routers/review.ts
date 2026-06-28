/**
 * راوتر التقييمات. التقييم موثّق: يُسمح به فقط لمن اشترى المنتج فعلاً
 * (طلب وصل أو اكتمل). تقييم واحد لكل (مستخدم، منتج) قابل للتعديل.
 * عند الحفظ تُعاد حسبة تقييم المنتج وتجميع تقييم البائع.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { Prisma } from "@al-souq/db";
import { reviewCreateSchema } from "@al-souq/validators";
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
});

/** يعيد حساب تقييم المنتج ثم يجمّع تقييم بائعه. */
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

  const product = await tx.product.findUnique({ where: { id: productId }, select: { vendorId: true } });
  if (!product) return;
  const vAgg = await tx.product.aggregate({
    where: { vendorId: product.vendorId, ratingCount: { gt: 0 } },
    _avg: { ratingAvg: true },
    _sum: { ratingCount: true },
  });
  await tx.vendorProfile.update({
    where: { id: product.vendorId },
    data: {
      ratingAvg: vAgg._avg.ratingAvg ?? new Prisma.Decimal(0),
      ratingCount: vAgg._sum.ratingCount ?? 0,
    },
  });
}
