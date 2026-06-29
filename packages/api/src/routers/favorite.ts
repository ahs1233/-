/** راوتر المفضلة — مملوكة للمستخدم. */
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const favoriteRouter = router({
  // معرّفات المنتجات المفضّلة (لإظهار حالة القلب بسرعة)
  ids: protectedProcedure.query(async ({ ctx }) => {
    const favs = await ctx.prisma.favorite.findMany({
      where: { userId: ctx.user.id },
      select: { productId: true },
    });
    return favs.map((f) => f.productId);
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const favs = await ctx.prisma.favorite.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            basePrice: true,
            ratingAvg: true,
            ratingCount: true,
            status: true,
            images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
            vendor: { select: { storeName: true, slug: true } },
          },
        },
      },
    });
    return favs
      .filter((f) => f.product.status === "ACTIVE")
      .map((f) => ({
        id: f.product.id,
        title: f.product.title,
        slug: f.product.slug,
        price: Number(f.product.basePrice),
        ratingAvg: Number(f.product.ratingAvg),
        ratingCount: f.product.ratingCount,
        image: f.product.images[0]?.url ?? null,
        vendor: f.product.vendor,
      }));
  }),

  toggle: protectedProcedure
    .meta({ openapi: { method: "POST", path: "/favorites/toggle", tags: ["favorite"], protect: true } })
    .input(z.object({ productId: z.string().cuid() }))
    .output(z.object({ favorited: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.favorite.findUnique({
        where: { userId_productId: { userId: ctx.user.id, productId: input.productId } },
      });
      if (existing) {
        await ctx.prisma.favorite.delete({ where: { id: existing.id } });
        return { favorited: false };
      }
      await ctx.prisma.favorite.create({ data: { userId: ctx.user.id, productId: input.productId } });
      return { favorited: true };
    }),
});
