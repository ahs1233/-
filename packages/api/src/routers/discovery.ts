/**
 * راوتر الاكتشاف — السطح الوحيد الذي تقرأ منه الصفحة الرئيسية.
 * لا يقرأ الـUI من الكتالوج مباشرةً؛ كل الأقسام تأتي من DiscoveryService.
 * قراءة عامة (بلا مصادقة)، معزولة بالمحافظة مع احتياط كل-العراق.
 */
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { getHomeSections, getHomeExtras, getMarketStores, getCityStats, getMarketCounts } from "../services/discovery";

export const discoveryRouter = router({
  home: publicProcedure
    .input(z.object({ governorateId: z.string().cuid().optional(), channel: z.enum(["physical", "online"]).optional(), categoryIds: z.array(z.string().cuid()).max(60).optional(), strict: z.boolean().optional() }).optional())
    .query(({ ctx, input }) => getHomeSections(ctx.prisma, input?.governorateId, input?.channel, input?.categoryIds, input?.strict)),

  // إحصاءات حيّة + جهة موصى بها + نبض السوق — للرأس السينمائيّ للرئيسية
  homeExtras: publicProcedure
    .input(z.object({ governorateId: z.string().cuid().optional(), channel: z.enum(["physical", "online"]).optional() }).optional())
    .query(({ ctx, input }) => getHomeExtras(ctx.prisma, input?.governorateId, input?.channel)),

  // كلّ متاجر السوق (محافظة + قناة [+ أقسام]) — لعرضها في صفحة كلّ سوق.
  marketStores: publicProcedure
    .input(z.object({ governorateId: z.string().cuid().optional(), channel: z.enum(["physical", "online"]).optional(), categoryIds: z.array(z.string().cuid()).max(60).optional() }).optional())
    .query(({ ctx, input }) => getMarketStores(ctx.prisma, input?.governorateId, input?.channel, input?.categoryIds)),

  // أرقام المدينة الحيّة — لبطل الرئيسية («اليوم في بغداد»).
  cityStats: publicProcedure
    .input(z.object({ governorateId: z.string().cuid().optional(), channel: z.enum(["physical", "online"]).optional() }).optional())
    .query(({ ctx, input }) => getCityStats(ctx.prisma, input?.governorateId, input?.channel)),

  // عدّاد متاجر كلّ سوق — للدليل المدمج في الرئيسية.
  marketCounts: publicProcedure
    .input(z.object({
      governorateId: z.string().cuid().optional(),
      markets: z.array(z.object({
        id: z.string().trim().min(1).max(64),
        channel: z.enum(["physical", "online"]).optional(),
        categoryIds: z.array(z.string().cuid()).max(60).optional(),
      })).max(40),
    }))
    .query(({ ctx, input }) => getMarketCounts(ctx.prisma, input.governorateId, input.markets)),
});
