/** راوتر الجغرافيا — المحافظات والمناطق العراقية (لاختيار العناوين). */
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { getDeliveryFee } from "../services/order";

export const geoRouter = router({
  /** رسوم التوصيل الفعلية لمحافظة (أو الافتراضية) — لعرضها في إتمام الطلب. */
  deliveryFee: publicProcedure
    .meta({ openapi: { method: "GET", path: "/geo/delivery-fee", tags: ["geo"] } })
    .input(z.object({ governorateId: z.string().cuid().optional() }))
    .output(z.object({ fee: z.number() }))
    .query(async ({ ctx, input }) => {
      return { fee: await getDeliveryFee(ctx.prisma, input.governorateId) };
    }),

  governorates: publicProcedure
    .meta({ openapi: { method: "GET", path: "/geo/governorates", tags: ["geo"] } })
    .input(z.void())
    .output(
      z.array(
        z.object({
          id: z.string(),
          nameAr: z.string(),
          code: z.string(),
          areas: z.array(z.object({ id: z.string(), nameAr: z.string() })),
        }),
      ),
    )
    .query(async ({ ctx }) => {
      return ctx.prisma.governorate.findMany({
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          nameAr: true,
          code: true,
          areas: { select: { id: true, nameAr: true }, orderBy: { nameAr: "asc" } },
        },
      });
    }),
});
