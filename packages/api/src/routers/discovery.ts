/**
 * راوتر الاكتشاف — السطح الوحيد الذي تقرأ منه الصفحة الرئيسية.
 * لا يقرأ الـUI من الكتالوج مباشرةً؛ كل الأقسام تأتي من DiscoveryService.
 * قراءة عامة (بلا مصادقة)، معزولة بالمحافظة مع احتياط كل-العراق.
 */
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { getHomeSections } from "../services/discovery";

export const discoveryRouter = router({
  home: publicProcedure
    .input(z.object({ governorateId: z.string().cuid().optional() }).optional())
    .query(({ ctx, input }) => getHomeSections(ctx.prisma, input?.governorateId)),
});
