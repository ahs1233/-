/** راوتر الجغرافيا — المحافظات والمناطق العراقية (لاختيار العناوين). */
import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const geoRouter = router({
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
