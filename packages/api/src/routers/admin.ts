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

  // ── ملخّص مالي/محاسبي (بفلتر زمني) ──
  financeSummary: adminProcedure
    .input(z.object({ period: z.enum(["today", "7d", "30d", "all"]).default("30d") }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      let since: Date | null = null;
      if (input.period === "today") since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      else if (input.period === "7d") since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else if (input.period === "30d") since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // الإيراد يُعترف به على الطلبات المُنجزة (مسلّمة/مكتملة) ضمن الفترة.
      const realizedWhere = {
        status: { in: ["DELIVERED", "COMPLETED"] as OrderStatus[] },
        ...(since ? { placedAt: { gte: since } } : {}),
      };
      const [agg, unsettled, settledAgg] = await Promise.all([
        ctx.prisma.order.aggregate({
          where: realizedWhere,
          _sum: { subtotal: true, deliveryFee: true, commissionAmount: true, total: true },
          _count: true,
        }),
        // الرصيد المستحق للبائعين (غير مسوّى) — رصيد لحظي لا يتقيّد بالفترة.
        ctx.prisma.commission.findMany({
          where: { payoutId: null, order: { status: { in: ["DELIVERED", "COMPLETED"] } } },
          include: { order: { select: { subtotal: true } } },
        }),
        ctx.prisma.payout.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
      ]);

      const merchandiseSales = Number(agg._sum.subtotal ?? 0); // مبيعات البضاعة
      const deliveryRevenue = Number(agg._sum.deliveryFee ?? 0); // رسوم التوصيل (تعود للمنصّة)
      const commissionRevenue = Number(agg._sum.commissionAmount ?? 0);
      const gmv = Number(agg._sum.total ?? 0); // إجمالي قيمة الطلبات (بضاعة + توصيل)
      const realizedOrders = agg._count;

      const platformRevenue = commissionRevenue + deliveryRevenue; // صافي دخل المنصّة
      const vendorEarnings = merchandiseSales - commissionRevenue; // ما يكسبه البائعون على المُنجز بالفترة
      const avgOrderValue = realizedOrders > 0 ? gmv / realizedOrders : 0;

      let outstandingPayable = 0;
      for (const c of unsettled) outstandingPayable += Number(c.order.subtotal) - Number(c.amount);
      const settledTotal = Number(settledAgg._sum.amount ?? 0);

      return {
        period: input.period,
        merchandiseSales,
        deliveryRevenue,
        commissionRevenue,
        gmv,
        platformRevenue,
        vendorEarnings,
        realizedOrders,
        avgOrderValue,
        outstandingPayable,
        settledTotal,
      };
    }),

  // ── البائعون ──
  vendors: adminProcedure
    .input(z.object({ status: z.string().optional(), search: z.string().trim().max(60).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: Prisma.VendorProfileWhereInput = {};
      if (input?.status) where.status = input.status as Prisma.EnumVendorStatusFilter["equals"];
      if (input?.search) where.storeName = { contains: input.search, mode: "insensitive" };
      const vendors = await ctx.prisma.vendorProfile.findMany({
        where,
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

  // تفاصيل بائع مع بياناته المالية (مبيعات، عمولة، رصيد مستحق، مسوّى، وطلبات حديثة).
  vendorDetail: adminProcedure.input(z.object({ id: z.string().cuid() })).query(async ({ ctx, input }) => {
    const v = await ctx.prisma.vendorProfile.findUnique({
      where: { id: input.id },
      include: {
        user: { select: { phone: true, name: true } },
        governorate: { select: { nameAr: true } },
        _count: { select: { products: true, orders: true } },
      },
    });
    if (!v) throw new TRPCError({ code: "NOT_FOUND", message: "البائع غير موجود" });

    const realized = { in: ["DELIVERED", "COMPLETED"] as OrderStatus[] };
    const [salesAgg, unsettled, settledAgg, recentOrders] = await Promise.all([
      ctx.prisma.order.aggregate({
        where: { vendorId: v.id, status: realized },
        _sum: { subtotal: true, commissionAmount: true },
        _count: true,
      }),
      ctx.prisma.commission.findMany({
        where: { vendorId: v.id, payoutId: null, order: { status: realized } },
        include: { order: { select: { subtotal: true } } },
      }),
      ctx.prisma.payout.aggregate({ where: { vendorId: v.id, status: "PAID" }, _sum: { amount: true } }),
      ctx.prisma.order.findMany({
        where: { vendorId: v.id },
        orderBy: { placedAt: "desc" },
        take: 8,
        select: { id: true, number: true, status: true, total: true, placedAt: true },
      }),
    ]);
    let outstanding = 0;
    for (const c of unsettled) outstanding += Number(c.order.subtotal) - Number(c.amount);

    return {
      id: v.id,
      storeName: v.storeName,
      slug: v.slug,
      status: v.status,
      description: v.description,
      rejectionNote: v.rejectionNote,
      phone: v.user.phone,
      ownerName: v.user.name,
      governorate: v.governorate?.nameAr ?? null,
      commissionRate: v.commissionRate ? Number(v.commissionRate) : null,
      createdAt: v.createdAt,
      productsCount: v._count.products,
      ordersCount: v._count.orders,
      realizedSales: Number(salesAgg._sum.subtotal ?? 0),
      commissionPaid: Number(salesAgg._sum.commissionAmount ?? 0),
      realizedOrders: salesAgg._count,
      outstanding,
      settled: Number(settledAgg._sum.amount ?? 0),
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        total: Number(o.total),
        placedAt: o.placedAt,
      })),
    };
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

    const TITLES: Record<string, string> = {
      ACTIVE: "تم نشر منتجك",
      REJECTED: "تم رفض منتجك",
      ARCHIVED: "تم إخفاء منتجك",
    };
    const ACTIONS: Record<string, string> = { ACTIVE: "approve", REJECTED: "reject", ARCHIVED: "archive" };

    await ctx.prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id: product.id }, data: { status: input.decision } });
      await tx.notification.create({
        data: {
          userId: product.vendor.userId,
          type: `product.${input.decision.toLowerCase()}`,
          title: TITLES[input.decision] ?? "تحديث حالة المنتج",
          body:
            input.decision === "ACTIVE"
              ? `«${product.title}» أصبح منشوراً.`
              : (input.note ?? `تم تحديث حالة «${product.title}».`),
          data: { productId: product.id },
        },
      });
      await writeAudit(tx, {
        actorId: ctx.user.id,
        action: `product.${ACTIONS[input.decision] ?? "update"}`,
        entityType: "Product",
        entityId: product.id,
        before: { status: product.status },
        after: { status: input.decision },
        ip: ctx.reqIp,
      });
    });
    return { ok: true };
  }),

  // منتجات متجر بعينه (لإدارتها من لوحة الأدمن) — كل الحالات.
  vendorProducts: adminProcedure.input(z.object({ vendorId: z.string().cuid() })).query(async ({ ctx, input }) => {
    const products = await ctx.prisma.product.findMany({
      where: { vendorId: input.vendorId },
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { nameAr: true } },
        images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
      },
    });
    return products.map((p) => ({
      id: p.id,
      title: p.title,
      price: Number(p.basePrice),
      status: p.status,
      soldCount: p.soldCount,
      category: p.category.nameAr,
      image: p.images[0]?.url ?? null,
    }));
  }),

  // ضبط نسبة عمولة خاصة بمتجر (null = استخدام النسبة العامة للمنصّة).
  setVendorCommission: adminProcedure
    .input(z.object({ vendorId: z.string().cuid(), rate: z.number().min(0).max(1).nullable() }))
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.prisma.vendorProfile.findUnique({
        where: { id: input.vendorId },
        select: { commissionRate: true },
      });
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "البائع غير موجود" });
      await ctx.prisma.vendorProfile.update({
        where: { id: input.vendorId },
        data: { commissionRate: input.rate === null ? null : new Prisma.Decimal(input.rate) },
      });
      await writeAudit(ctx.prisma, {
        actorId: ctx.user.id,
        action: "vendor.commission",
        entityType: "VendorProfile",
        entityId: input.vendorId,
        before: { commissionRate: before.commissionRate ? Number(before.commissionRate) : null },
        after: { commissionRate: input.rate },
        ip: ctx.reqIp,
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
    .input(
      z
        .object({
          status: z.string().optional(),
          search: z.string().trim().max(60).optional(),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.OrderWhereInput = {};
      if (input?.status) where.status = input.status as OrderStatus;
      if (input?.search) {
        where.OR = [
          { number: { contains: input.search, mode: "insensitive" } },
          { customer: { phone: { contains: input.search } } },
        ];
      }
      const orders = await ctx.prisma.order.findMany({
        where,
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

  // تفاصيل طلب واحد (لوحة الإدارة) — دون قيد ملكية.
  orderDetail: adminProcedure.input(z.object({ id: z.string().cuid() })).query(async ({ ctx, input }) => {
    const o = await ctx.prisma.order.findUnique({
      where: { id: input.id },
      include: {
        vendor: { select: { id: true, storeName: true, slug: true } },
        customer: { select: { name: true, phone: true } },
        items: true,
        history: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!o) throw new TRPCError({ code: "NOT_FOUND", message: "الطلب غير موجود" });
    return {
      id: o.id,
      number: o.number,
      status: o.status,
      paymentMethod: o.paymentMethod,
      subtotal: Number(o.subtotal),
      deliveryFee: Number(o.deliveryFee),
      total: Number(o.total),
      commissionRate: Number(o.commissionRate),
      commissionAmount: Number(o.commissionAmount),
      shipTo: o.shipTo,
      customerNote: o.customerNote,
      cancelReason: o.cancelReason,
      placedAt: o.placedAt,
      vendor: o.vendor,
      customer: o.customer,
      items: o.items.map((it) => ({
        id: it.id,
        title: it.titleSnapshot,
        attributes: it.attributesSnapshot,
        unitPrice: Number(it.unitPrice),
        quantity: it.quantity,
        lineTotal: Number(it.lineTotal),
      })),
      history: o.history.map((h) => ({
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        note: h.note,
        createdAt: h.createdAt,
      })),
    };
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
    const byGov = map.delivery_fees_by_gov;
    return {
      commissionRate: typeof map.commission_rate === "number" ? map.commission_rate : 0.1,
      deliveryFee: typeof map.delivery_fee === "number" ? map.delivery_fee : 5000,
      deliveryFeesByGov: (byGov && typeof byGov === "object" ? byGov : {}) as Record<string, number>,
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
    if (input.deliveryFeesByGov !== undefined) {
      ops.push(
        ctx.prisma.platformSetting.upsert({
          where: { key: "delivery_fees_by_gov" },
          update: { value: input.deliveryFeesByGov },
          create: { key: "delivery_fees_by_gov", value: input.deliveryFeesByGov },
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
