/**
 * راوتر الأسواق — قراءةٌ عامّة لأسواق «السوگ» (كلّ سوقٍ عالمٌ مستقلّ).
 * الرئيسية تعرضها ليختار المستخدم أيّ سوقٍ يدخل. التعديل في راوتر admin.
 */
import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export interface MarketItem {
  id: string;
  slug: string;
  nameAr: string;
  tagline: string | null;
  imageUrl: string | null;
  icon: string | null;
  kind: string;
  categorySlug: string | null;
  href: string | null;
  status: string;
}

export const marketRouter = router({
  list: publicProcedure.query(async ({ ctx }): Promise<MarketItem[]> => {
    const rows = await ctx.prisma.market.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true, slug: true, nameAr: true, tagline: true, imageUrl: true,
        icon: true, kind: true, categorySlug: true, href: true, status: true,
      },
    });
    return rows;
  }),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }): Promise<MarketItem | null> => {
      const m = await ctx.prisma.market.findUnique({
        where: { slug: input.slug },
        select: {
          id: true, slug: true, nameAr: true, tagline: true, imageUrl: true,
          icon: true, kind: true, categorySlug: true, href: true, status: true, enabled: true,
        },
      });
      if (!m || !m.enabled) return null;
      const { enabled: _enabled, ...rest } = m;
      return rest;
    }),
});
