/** راوتر الإشعارات (داخل التطبيق). إشعارات Push الفعلية في المرحلة 6. */
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const notificationRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const items = await ctx.prisma.notification.findMany({
        where: { userId: ctx.user.id },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 30,
      });
      return items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data,
        readAt: n.readAt,
        createdAt: n.createdAt,
      }));
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.notification.count({ where: { userId: ctx.user.id, readAt: null } });
  }),

  markRead: protectedProcedure.input(z.object({ id: z.string().cuid() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.notification.updateMany({
      where: { id: input.id, userId: ctx.user.id },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.notification.updateMany({
      where: { userId: ctx.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }),
});
