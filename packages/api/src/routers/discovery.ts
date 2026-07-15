/**
 * راوتر الاكتشاف — السطح الوحيد الذي تقرأ منه الصفحة الرئيسية.
 * لا يقرأ الـUI من الكتالوج مباشرةً؛ كل الأقسام تأتي من DiscoveryService.
 * قراءة عامة (بلا مصادقة)، معزولة بالمحافظة مع احتياط كل-العراق.
 */
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { getHomeSections, getHomeExtras } from "../services/discovery";

export const discoveryRouter = router({
  home: publicProcedure
    .input(z.object({ governorateId: z.string().cuid().optional(), channel: z.enum(["physical", "online"]).optional() }).optional())
    .query(({ ctx, input }) => getHomeSections(ctx.prisma, input?.governorateId, input?.channel)),

  // إحصاءات حيّة + جهة موصى بها + نبض السوق — للرأس السينمائيّ للرئيسية
  homeExtras: publicProcedure
    .input(z.object({ governorateId: z.string().cuid().optional(), channel: z.enum(["physical", "online"]).optional() }).optional())
    .query(({ ctx, input }) => getHomeExtras(ctx.prisma, input?.governorateId, input?.channel)),
});
