/**
 * راوتر الأدمن. كل إجراء حسّاس يُسجَّل في سجل التدقيق (AuditLog).
 * محمي بـ adminProcedure (RBAC).
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { Prisma, type OrderStatus } from "@al-souq/db";
import { slugify } from "@al-souq/utils";
import {
  vendorReviewSchema,
  productReviewSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  userManageSchema,
  platformSettingsSchema,
} from "@al-souq/validators";
import { router, adminProcedure } from "../trpc";
import { writeAudit, settleVendorPayout } from "../services/admin";
import { changeOrderStatus } from "../services/order";

export const adminRouter = router({
  // ── لوحة المؤشرات (KPIs) ──
  dashboard: adminProcedure.query(async ({ ctx }) => {
    const [users, vendorsByStatus, productsByStatus, ordersByStatus, gmvAgg, pendingVendors, pendingProducts] =
      await Promise.all([
        ctx.prisma.user.count(),
        ctx.prisma.vendorProfile.groupBy({ by: ["status"], _count: true }),
        ctx.prisma.product.groupBy({ by: ["status"], _count: true }),
        ctx.prisma.order.groupBy({ by: ["status"], _count: true }),
        ctx.prisma.order.aggregate({
          where: { status: { in: ["DELIVERED", "COMPLETED"] } },
          _sum: { total: true, commissionAmount: true },
          _count: true,
        }),
        ctx.prisma.vendorProfile.count({ where: { status: "PENDING" } }),
        ctx.prisma.product.count({ where: { status: "PENDING_REVIEW" } }),
      ]);
    const toMap = (arr: { status: string; _count: number }[]) =>
      Object.fromEntries(arr.map((g) => [g.status, g._count]));
    return {
      users,
      vendorsByStatus: toMap(vendorsByStatus),
      productsByStatus: toMap(productsByStatus),
      ordersByStatus: toMap(ordersByStatus),
      gmv: Number(gmvAgg._sum.total ?? 0),
      commissionRevenue: Number(gmvAgg._sum.commissionAmount ?? 0),
      realizedOrders: gmvAgg._count,
      pendingVendors,
      pendingProducts,
    };
  }),

  // ── البائعون ──
  vendors: adminProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const vendors = await ctx.prisma.vendorProfile.findMany({
        where: input?.status ? { status: input.status as Prisma.EnumVendorStatusFilter["equals"] } : {},
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { phone: true, name: true } },
          governorate: { select: { nameAr: true } },
          _count: { select: { products: true, orders: true } },
        },
      });
      return vendors.map((v) => ({
        id: v.id,
        storeName: v.storeName,
        slug: v.slug,
        status: v.status,
        phone: v.user.phone,
        ownerName: v.user.name,
        governorate: v.governorate?.nameAr ?? null,
        products: v._count.products,
        orders: v._count.orders,
        createdAt: v.createdAt,
      }));
    }),

  reviewVendor: adminProcedure.input(vendorReviewSchema).mutation(async ({ ctx, input }) => {
    const vendor = await ctx.prisma.vendorProfile.findUnique({ where: { id: input.vendorId } });
    if (!vendor) throw new TRPCError({ code: "NOT_FOUND", message: "البائع غير موجود" });

    const statusMap = { APPROVED: "APPROVED", REJECTED: "REJECTED", SUSPENDED: "SUSPENDED" } as const;
    const newStatus = statusMap[input.decision];

    await ctx.prisma.$transaction(async (tx) => {
      await tx.vendorProfile.update({
        where: { id: vendor.id },
        data: {
          status: newStatus,
          approvedAt: input.decision === "APPROVED" ? new Date() : vendor.approvedAt,
          rejectionNote: input.decision === "REJECTED" ? input.note : null,
        },
      });
      await tx.notification.create({
        data: {
          userId: vendor.userId,
          type: `vendor.${input.decision.toLowerCase()}`,
          title:
            input.decision === "APPROVED"
              ? "تم اعتماد متجرك"
              : input.decision === "REJECTED"
                ? "تم رفض طلب المتجر"
                : "تم تعليق متجرك",
          body: input.note,
          data: { vendorId: vendor.id },
        },
      });
      await writeAudit(tx, {
        actorId: ctx.user.id,
        action: `vendor.${input.decision.toLowerCase()}`,
        entityType: "VendorProfile",
        entityId: vendor.id,
        before: { status: vendor.status },
        after: { status: newStatus },
        ip: ctx.reqIp,
      });
    });
    return { ok: true };
  }),

  // ── مراجعة المنتجات ──
  pendingProducts: adminProcedure.query(async ({ ctx }) => {
    const products = await ctx.prisma.product.findMany({
      where: { status: "PENDING_REVIEW" },
      orderBy: { updatedAt: "asc" },
      include: {
        vendor: { select: { storeName: true } },
        category: { select: { nameAr: true } },
        images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
      },
    });
    return products.map((p) => ({
      id: p.id,
      title: p.title,
      price: Number(p.basePrice),
      vendor: p.vendor.storeName,
      category: p.category.nameAr,
      image: p.images[0]?.url ?? null,
    }));
  }),

  reviewProduct: adminProcedure.input(productReviewSchema).mutation(async ({ ctx, input }) => {
    const product = await ctx.prisma.product.findUnique({
      where: { id: input.productId },
      include: { vendor: { select: { userId: true } } },
    });
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "المنتج غير موجود" });

    await ctx.prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id: product.id }, data: { status: input.decision } });
      await tx.notification.create({
        data: {
          userId: product.vendor.userId,
          type: `product.${input.decision.toLowerCase()}`,
          title: input.decision === "ACTIVE" ? "تم نشر منتجك" : "تم رفض منتجك",
          body: input.decision === "REJECTED" ? input.note : `«${product.title}» أصبح منشوراً.`,
          data: { productId: product.id },
        },
      });
      await writeAudit(tx, {
        actorId: ctx.user.id,
        action: `product.${input.decision === "ACTIVE" ? "approve" : "reject"}`,
        entityType: "Product",
        entityId: product.id,
        before: { status: product.status },
        after: { status: input.decision },
        ip: ctx.reqIp,
      });
    });
    return { ok: true };
  }),

  // ── الفئات ──
  categories: adminProcedure.query(async ({ ctx }) => {
    const cats = await ctx.prisma.category.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
      include: { _count: { select: { products: true, children: true } } },
    });
    return cats.map((c) => ({
      id: c.id,
      nameAr: c.nameAr,
      slug: c.slug,
      icon: c.icon,
      parentId: c.parentId,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      products: c._count.products,
      children: c._count.children,
    }));
  }),

  createCategory: adminProcedure.input(categoryCreateSchema).mutation(async ({ ctx, input }) => {
    const slug = `${slugify(input.nameAr)}-${Math.random().toString(36).slice(2, 6)}`;
    const cat = await ctx.prisma.category.create({
      data: {
        nameAr: input.nameAr,
        slug,
        icon: input.icon,
        parentId: input.parentId ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    await writeAudit(ctx.prisma, {
      actorId: ctx.user.id,
      action: "category.create",
      entityType: "Category",
      entityId: cat.id,
      after: { nameAr: cat.nameAr },
      ip: ctx.reqIp,
    });
    return { id: cat.id };
  }),

  updateCategory: adminProcedure.input(categoryUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    await ctx.prisma.category.update({ where: { id }, data });
    await writeAudit(ctx.prisma, {
      actorId: ctx.user.id,
      action: "category.update",
      entityType: "Category",
      entityId: id,
      after: data,
      ip: ctx.reqIp,
    });
    return { ok: true };
  }),

  removeCategory: adminProcedure.input(z.object({ id: z.string().cuid() })).mutation(async ({ ctx, input }) => {
    const cat = await ctx.prisma.category.findUnique({
      where: { id: input.id },
      include: { _count: { select: { products: true, children: true } } },
    });
    if (!cat) throw new TRPCError({ code: "NOT_FOUND", message: "الفئة غير موجودة" });
    if (cat._count.products > 0 || cat._count.children > 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن حذف فئة تحتوي منتجات أو فئات فرعية" });
    }
    await ctx.prisma.category.delete({ where: { id: input.id } });
    await writeAudit(ctx.prisma, {
      actorId: ctx.user.id,
      action: "category.delete",
      entityType: "Category",
      entityId: input.id,
      before: { nameAr: cat.nameAr },
      ip: ctx.reqIp,
    });
    return { ok: true };
  }),

  // ── الطلبات والنزاعات ──
  orders: adminProcedure
    .input(z.object({ status: z.string().optional(), limit: z.number().int().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const orders = await ctx.prisma.order.findMany({
        where: input?.status ? { status: input.status as OrderStatus } : {},
        orderBy: { placedAt: "desc" },
        take: input?.limit ?? 50,
        include: { vendor: { select: { storeName: true } }, customer: { select: { name: true, phone: true } } },
      });
      return orders.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        total: Number(o.total),
        vendor: o.vendor.storeName,
        customer: o.customer.name ?? o.customer.phone,
        placedAt: o.placedAt,
      }));
    }),

  // حلّ النزاعات: الأدمن يفرض حالة (يتقيّد بصحة الانتقال عبر آلة الحالة)
  forceOrderStatus: adminProcedure
    .input(
      z.object({
        orderId: z.string().cuid(),
        status: z.enum(["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "RETURNED"]),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await changeOrderStatus(ctx.prisma, {
        orderId: input.orderId,
        to: input.status,
        actor: "ADMIN",
        actorId: ctx.user.id,
        note: input.note,
      });
      await writeAudit(ctx.prisma, {
        actorId: ctx.user.id,
        action: "order.force_status",
        entityType: "Order",
        entityId: input.orderId,
        after: { status: input.status, note: input.note },
        ip: ctx.reqIp,
      });
      return result;
    }),

  // ── التسويات ──
  payoutBalances: adminProcedure.query(async ({ ctx }) => {
    // العمولات غير المسوّاة لطلبات مسلّمة/مكتملة، مجمّعة حسب البائع
    const rows = await ctx.prisma.commission.findMany({
      where: { payoutId: null, order: { status: { in: ["DELIVERED", "COMPLETED"] } } },
      include: { order: { select: { subtotal: true } } },
    });
    const byVendor = new Map<string, number>();
    for (const r of rows) {
      const net = Number(r.order.subtotal) - Number(r.amount);
      byVendor.set(r.vendorId, (byVendor.get(r.vendorId) ?? 0) + net);
    }
    const vendorIds = [...byVendor.keys()];
    const vendors = await ctx.prisma.vendorProfile.findMany({
      where: { id: { in: vendorIds } },
      select: { id: true, storeName: true },
    });
    return vendors.map((v) => ({ vendorId: v.id, storeName: v.storeName, balance: byVendor.get(v.id) ?? 0 }));
  }),

  settlePayout: adminProcedure.input(z.object({ vendorId: z.string().cuid() })).mutation(async ({ ctx, input }) => {
    const result = await settleVendorPayout(ctx.prisma, { vendorId: input.vendorId, adminId: ctx.user.id, ip: ctx.reqIp });
    if (!result) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يوجد رصيد مستحق للتسوية" });
    return result;
  }),

  payoutHistory: adminProcedure.query(async ({ ctx }) => {
    const payouts = await ctx.prisma.payout.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { vendor: { select: { storeName: true } } },
    });
    return payouts.map((p) => ({
      id: p.id,
      vendor: p.vendor.storeName,
      amount: Number(p.amount),
      status: p.status,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    }));
  }),

  // ── المستخدمون ──
  users: adminProcedure
    .input(z.object({ role: z.string().optional(), q: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const users = await ctx.prisma.user.findMany({
        where: {
          ...(input?.role ? { role: input.role as Prisma.EnumRoleFilter["equals"] } : {}),
          ...(input?.q ? { OR: [{ phone: { contains: input.q } }, { name: { contains: input.q } }] } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, phone: true, name: true, role: true, isBlocked: true, createdAt: true },
      });
      return users;
    }),

  manageUser: adminProcedure.input(userManageSchema).mutation(async ({ ctx, input }) => {
    if (input.userId === ctx.user.id) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكنك حظر نفسك" });
    }
    const blocked = input.action === "block";
    await ctx.prisma.user.update({ where: { id: input.userId }, data: { isBlocked: blocked } });
    if (blocked) {
      // إبطال كل جلسات المستخدم المحظور
      await ctx.prisma.session.updateMany({ where: { userId: input.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await writeAudit(ctx.prisma, {
      actorId: ctx.user.id,
      action: `user.${input.action}`,
      entityType: "User",
      entityId: input.userId,
      after: { isBlocked: blocked },
      ip: ctx.reqIp,
    });
    return { ok: true };
  }),

  // ── إعدادات المنصة ──
  getSettings: adminProcedure.query(async ({ ctx }) => {
    const settings = await ctx.prisma.platformSetting.findMany();
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    return {
      commissionRate: typeof map.commission_rate === "number" ? map.commission_rate : 0.1,
      deliveryFee: typeof map.delivery_fee === "number" ? map.delivery_fee : 5000,
    };
  }),

  updateSettings: adminProcedure.input(platformSettingsSchema).mutation(async ({ ctx, input }) => {
    const ops: Promise<unknown>[] = [];
    if (input.commissionRate !== undefined) {
      ops.push(
        ctx.prisma.platformSetting.upsert({
          where: { key: "commission_rate" },
          update: { value: input.commissionRate },
          create: { key: "commission_rate", value: input.commissionRate },
        }),
      );
    }
    if (input.deliveryFee !== undefined) {
      ops.push(
        ctx.prisma.platformSetting.upsert({
          where: { key: "delivery_fee" },
          update: { value: input.deliveryFee },
          create: { key: "delivery_fee", value: input.deliveryFee },
        }),
      );
    }
    await Promise.all(ops);
    await writeAudit(ctx.prisma, {
      actorId: ctx.user.id,
      action: "settings.update",
      entityType: "PlatformSetting",
      entityId: "platform",
      after: input,
      ip: ctx.reqIp,
    });
    return { ok: true };
  }),

  // ── سجل التدقيق ──
  auditLog: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const logs = await ctx.prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 50,
        include: { actor: { select: { name: true, phone: true } } },
      });
      return logs.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        actor: l.actor?.name ?? l.actor?.phone ?? "النظام",
        before: l.before,
        after: l.after,
        createdAt: l.createdAt,
      }));
    }),
});
