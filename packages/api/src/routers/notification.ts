/** راوتر الإشعارات (داخل التطبيق + Web Push). */
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { getVapidPublicKey, isPushConfigured, sendPush } from "../services/push";

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

  // ── Web Push ──
  pushConfig: publicProcedure.query(() => ({
    configured: isPushConfigured(),
    publicKey: getVapidPublicKey(),
  })),

  subscribe: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url(),
        keys: z.object({ p256dh: z.string(), auth: z.string() }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        update: { userId: ctx.user.id, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: ctx.userAgent },
        create: {
          userId: ctx.user.id,
          endpoint: input.endpoint,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent: ctx.userAgent,
        },
      });
      return { ok: true };
    }),

  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.pushSubscription.deleteMany({ where: { endpoint: input.endpoint, userId: ctx.user.id } });
      return { ok: true };
    }),

  // إرسال إشعار تجريبي للمستخدم نفسه (للتحقق من التهيئة)
  sendTest: protectedProcedure.mutation(async ({ ctx }) => {
    await sendPush(ctx.prisma, ctx.user.id, {
      title: "السوگ",
      body: "تم تفعيل الإشعارات بنجاح ✓",
      url: "/notifications",
    });
    return { ok: true };
  }),
});
