/**
 * راوتر الطلبات (المشتري). إنشاء طلب COD، عرض الطلبات وتتبّعها، الإلغاء،
 * وتأكيد الاستلام. كل وصول مقيّد بالملكية (حماية IDOR).
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { PrismaClient } from "@al-souq/db";
import { placeOrderSchema } from "@al-souq/validators";
import { router, protectedProcedure } from "../trpc";
import { placeOrder, changeOrderStatus, releaseExpiredReservations } from "../services/order";

export const orderRouter = router({
  place: protectedProcedure.input(placeOrderSchema).mutation(async ({ ctx, input }) => {
    await releaseExpiredReservations(ctx.prisma);
    const result = await placeOrder(ctx.prisma, {
      customerId: ctx.user.id,
      addressId: input.addressId,
      items: input.items,
      customerNote: input.customerNote,
    });
    return result;
  }),

  myOrders: protectedProcedure
    .input(z.object({ cursor: z.string().cuid().optional(), limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      await releaseExpiredReservations(ctx.prisma);
      const orders = await ctx.prisma.order.findMany({
        where: { customerId: ctx.user.id },
        orderBy: { placedAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: {
          vendor: { select: { storeName: true, slug: true } },
          items: { select: { id: true, titleSnapshot: true, quantity: true } },
          _count: { select: { items: true } },
        },
      });
      let nextCursor: string | undefined;
      if (orders.length > input.limit) nextCursor = orders.pop()!.id;
      return {
        items: orders.map((o) => ({
          id: o.id,
          number: o.number,
          status: o.status,
          total: Number(o.total),
          placedAt: o.placedAt,
          itemCount: o._count.items,
          firstItem: o.items[0]?.titleSnapshot ?? "",
          vendor: o.vendor,
        })),
        nextCursor,
      };
    }),

  byId: protectedProcedure.input(z.object({ id: z.string().cuid() })).query(async ({ ctx, input }) => {
    const order = await ctx.prisma.order.findUnique({
      where: { id: input.id },
      include: {
        vendor: { select: { storeName: true, slug: true } },
        items: true,
        history: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!order || order.customerId !== ctx.user.id) {
      throw new TRPCError({ code: "NOT_FOUND", message: "الطلب غير موجود" });
    }
    return {
      id: order.id,
      number: order.number,
      status: order.status,
      paymentMethod: order.paymentMethod,
      subtotal: Number(order.subtotal),
      deliveryFee: Number(order.deliveryFee),
      total: Number(order.total),
      shipTo: order.shipTo,
      customerNote: order.customerNote,
      cancelReason: order.cancelReason,
      placedAt: order.placedAt,
      vendor: order.vendor,
      items: order.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        title: it.titleSnapshot,
        attributes: it.attributesSnapshot,
        unitPrice: Number(it.unitPrice),
        quantity: it.quantity,
        lineTotal: Number(it.lineTotal),
      })),
      history: order.history.map((h) => ({
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        note: h.note,
        createdAt: h.createdAt,
      })),
    };
  }),

  cancel: protectedProcedure
    .input(z.object({ orderId: z.string().cuid(), reason: z.string().trim().max(200).optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnership(ctx.prisma, input.orderId, ctx.user.id);
      return changeOrderStatus(ctx.prisma, {
        orderId: input.orderId,
        to: "CANCELLED",
        actor: "CUSTOMER",
        actorId: ctx.user.id,
        note: input.reason,
      });
    }),

  confirmReceipt: protectedProcedure
    .input(z.object({ orderId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnership(ctx.prisma, input.orderId, ctx.user.id);
      return changeOrderStatus(ctx.prisma, {
        orderId: input.orderId,
        to: "COMPLETED",
        actor: "CUSTOMER",
        actorId: ctx.user.id,
      });
    }),
});

async function assertOwnership(prisma: PrismaClient, orderId: string, userId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { customerId: true } });
  if (!order || order.customerId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "الطلب غير موجود" });
  }
}
