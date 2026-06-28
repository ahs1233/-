/** راوتر العناوين — مملوكة للمستخدم (حماية IDOR على كل عملية). */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { PrismaClient } from "@al-souq/db";
import { addressSchema } from "@al-souq/validators";
import { router, protectedProcedure } from "../trpc";

export const addressRouter = router({
  list: protectedProcedure
    .meta({ openapi: { method: "GET", path: "/addresses", tags: ["address"], protect: true } })
    .input(z.void())
    .output(
      z.array(
        z.object({
          id: z.string(),
          fullName: z.string(),
          phone: z.string(),
          governorateId: z.string(),
          areaId: z.string(),
          governorate: z.string(),
          area: z.string(),
          line: z.string(),
          isDefault: z.boolean(),
        }),
      ),
    )
    .query(async ({ ctx }) => {
    const addresses = await ctx.prisma.address.findMany({
      where: { userId: ctx.user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      include: { governorate: { select: { nameAr: true } }, area: { select: { nameAr: true } } },
    });
    return addresses.map((a) => ({
      id: a.id,
      fullName: a.fullName,
      phone: a.phone,
      governorateId: a.governorateId,
      areaId: a.areaId,
      governorate: a.governorate.nameAr,
      area: a.area.nameAr,
      line: a.line,
      isDefault: a.isDefault,
    }));
  }),

  create: protectedProcedure.input(addressSchema).mutation(async ({ ctx, input }) => {
    // التحقق أن المنطقة تتبع المحافظة المختارة
    const area = await ctx.prisma.area.findUnique({ where: { id: input.areaId } });
    if (!area || area.governorateId !== input.governorateId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "المنطقة لا تتبع المحافظة المختارة" });
    }
    return ctx.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.address.updateMany({ where: { userId: ctx.user.id }, data: { isDefault: false } });
      }
      // أول عنوان يصبح افتراضياً تلقائياً
      const count = await tx.address.count({ where: { userId: ctx.user.id } });
      return tx.address.create({
        data: { ...input, userId: ctx.user.id, isDefault: input.isDefault || count === 0 },
      });
    });
  }),

  update: protectedProcedure
    .input(addressSchema.partial().extend({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwn(ctx.prisma, input.id, ctx.user.id);
      const { id, ...data } = input;
      return ctx.prisma.$transaction(async (tx) => {
        if (data.isDefault) {
          await tx.address.updateMany({ where: { userId: ctx.user.id }, data: { isDefault: false } });
        }
        return tx.address.update({ where: { id }, data });
      });
    }),

  setDefault: protectedProcedure.input(z.object({ id: z.string().cuid() })).mutation(async ({ ctx, input }) => {
    await assertOwn(ctx.prisma, input.id, ctx.user.id);
    await ctx.prisma.$transaction([
      ctx.prisma.address.updateMany({ where: { userId: ctx.user.id }, data: { isDefault: false } }),
      ctx.prisma.address.update({ where: { id: input.id }, data: { isDefault: true } }),
    ]);
    return { ok: true };
  }),

  remove: protectedProcedure.input(z.object({ id: z.string().cuid() })).mutation(async ({ ctx, input }) => {
    await assertOwn(ctx.prisma, input.id, ctx.user.id);
    await ctx.prisma.address.delete({ where: { id: input.id } });
    return { ok: true };
  }),
});

async function assertOwn(prisma: PrismaClient, id: string, userId: string) {
  const a = await prisma.address.findUnique({ where: { id }, select: { userId: true } });
  if (!a || a.userId !== userId) throw new TRPCError({ code: "NOT_FOUND", message: "العنوان غير موجود" });
}
