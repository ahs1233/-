/**
 * راوتر الأدمن. كل إجراء حسّاس يُسجَّل في سجل التدقيق (AuditLog).
 * محمي بـ adminProcedure (RBAC).
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { Prisma, type OrderStatus } from "@al-souq/db";
import { slugify, normalizeArabic } from "@al-souq/utils";
import {
  vendorReviewSchema,
  productReviewSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  categoryReorderSchema,
  userManageSchema,
  platformSettingsSchema,
  appearanceSchema,
  governoratePresentationSchema,
  adCreateSchema,
  adUpdateSchema,
  articleUpsertSchema,
  articleDeleteSchema,
  adDeleteSchema,
  marketCreateSchema,
  marketUpdateSchema,
  marketDeleteSchema,
  marketReorderSchema,
  marketDisplayUpdateSchema,
  presignUploadSchema,
  couponCreateSchema,
  couponToggleSchema,
  staffCreateSchema,
  staffUpdateSchema,
  storeProfileUpdateSchema,
  adminSectionUpsertSchema,
  adminSectionReorderSchema,
  storeActivityUpsertSchema,
  setStorePlanSchema,
  vendorPlansConfigSchema,
  idSchema,
} from "@al-souq/validators";
import { normalizePlansConfig } from "@al-souq/domain";
import { getStorage } from "@al-souq/storage";
import { effectivePermissions, isSuperAdmin, sanitizePermissions } from "@al-souq/auth";
import { router, adminProcedure, adminPerm } from "../trpc";
import type { Context } from "../context";
import { writeAudit, settleVendorPayout } from "../services/admin";
import { changeOrderStatus } from "../services/order";

export const adminRouter = router({
  // ── لوحة المؤشرات (KPIs) ──
  dashboard: adminPerm("dashboard")
    .input(z.object({ governorateId: z.string().cuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const todayStart = startOfDay(now).getTime();
    const DAYS = 14;
    const since14 = new Date(todayStart - (DAYS - 1) * 86_400_000);
    const since30 = new Date(now.getTime() - 30 * 86_400_000);
    const sincePrev30 = new Date(now.getTime() - 60 * 86_400_000);
    const REALIZED = { in: ["DELIVERED", "COMPLETED"] as OrderStatus[] };
    // فلتر المحافظة: مدير المحافظة مقيّدٌ بمحافظته؛ المدير العامّ يختار محافظةً أو الكلّ.
    const gov = ctx.user.scopeGovernorateId ?? input?.governorateId ?? undefined;
    const oGov: Prisma.OrderWhereInput = gov ? { vendor: { governorateId: gov } } : {};
    const vGov: Prisma.VendorProfileWhereInput = gov ? { governorateId: gov } : {};
    const pGov: Prisma.ProductWhereInput = gov ? { vendor: { governorateId: gov } } : {};

    const [
      users,
      vendorsByStatus,
      productsByStatus,
      ordersByStatus,
      gmvAgg,
      pendingVendors,
      pendingProducts,
      pendingReturns,
      windowOrders,
      cur30,
      prev30,
      topVendorsAgg,
      recentOrders,
    ] = await Promise.all([
      gov ? ctx.prisma.vendorProfile.count({ where: vGov }) : ctx.prisma.user.count(),
      ctx.prisma.vendorProfile.groupBy({ by: ["status"], where: vGov, _count: true }),
      ctx.prisma.product.groupBy({ by: ["status"], where: pGov, _count: true }),
      ctx.prisma.order.groupBy({ by: ["status"], where: oGov, _count: true }),
      ctx.prisma.order.aggregate({
        where: { status: REALIZED, ...oGov },
        _sum: { total: true, commissionAmount: true },
        _count: true,
      }),
      ctx.prisma.vendorProfile.count({ where: { status: "PENDING", ...vGov } }),
      ctx.prisma.product.count({ where: { status: "PENDING_REVIEW", ...pGov } }),
      ctx.prisma.returnRequest.count({ where: { status: "REQUESTED", ...(gov ? { order: { vendor: { governorateId: gov } } } : {}) } }),
      ctx.prisma.order.findMany({
        where: { placedAt: { gte: since14 }, status: REALIZED, ...oGov },
        select: { placedAt: true, total: true },
      }),
      ctx.prisma.order.aggregate({
        where: { status: REALIZED, placedAt: { gte: since30 }, ...oGov },
        _sum: { total: true },
        _count: true,
      }),
      ctx.prisma.order.aggregate({
        where: { status: REALIZED, placedAt: { gte: sincePrev30, lt: since30 }, ...oGov },
        _sum: { total: true },
        _count: true,
      }),
      ctx.prisma.order.groupBy({
        by: ["vendorId"],
        where: { status: REALIZED, ...oGov },
        _sum: { total: true },
        orderBy: { _sum: { total: "desc" } },
        take: 5,
      }),
      ctx.prisma.order.findMany({
        where: oGov,
        orderBy: { placedAt: "desc" },
        take: 6,
        include: { vendor: { select: { storeName: true } } },
      }),
    ]);

    const toMap = (arr: { status: string; _count: number }[]) =>
      Object.fromEntries(arr.map((g) => [g.status, g._count]));

    // سلسلة مبيعات آخر ١٤ يوماً (مُنجزة)
    const salesSeries = Array.from({ length: DAYS }, (_, k) => {
      const dd = new Date(todayStart - (DAYS - 1 - k) * 86_400_000);
      return { day: `${dd.getMonth() + 1}/${dd.getDate()}`, revenue: 0, orders: 0 };
    });
    for (const o of windowOrders) {
      const diff = Math.floor((todayStart - startOfDay(o.placedAt).getTime()) / 86_400_000);
      const bucket = salesSeries[DAYS - 1 - diff];
      if (bucket) {
        bucket.revenue += Number(o.total);
        bucket.orders += 1;
      }
    }

    // أعلى المتاجر مبيعاً (بأسمائها)
    const topVendorNames = await ctx.prisma.vendorProfile.findMany({
      where: { id: { in: topVendorsAgg.map((t) => t.vendorId) } },
      select: { id: true, storeName: true },
    });
    const nameMap = new Map(topVendorNames.map((v) => [v.id, v.storeName]));
    const topVendors = topVendorsAgg.map((t) => ({
      id: t.vendorId,
      storeName: nameMap.get(t.vendorId) ?? "—",
      sales: Number(t._sum.total ?? 0),
    }));

    // ── صحّة الكتالوج (بناءً على البيانات الأحدث: التوثيق، الخصومات، المخزون، الموقع) ──
    const d7 = new Date(now.getTime() - 7 * 86_400_000);
    const [storesApproved, storesVerified, storesLocated, newStores7, offersActive, outOfStock] = await Promise.all([
      ctx.prisma.vendorProfile.count({ where: { status: "APPROVED", ...vGov } }),
      ctx.prisma.vendorProfile.count({ where: { status: "APPROVED", verified: true, ...vGov } }),
      ctx.prisma.vendorProfile.count({ where: { status: "APPROVED", latitude: { not: null }, ...vGov } }),
      ctx.prisma.vendorProfile.count({ where: { status: "APPROVED", createdAt: { gte: d7 }, ...vGov } }),
      ctx.prisma.product.count({ where: { status: "ACTIVE", compareAtPrice: { not: null }, ...pGov } }),
      ctx.prisma.product.count({ where: { status: "ACTIVE", ...pGov, variants: { none: { stock: { gt: 0 } } } } }),
    ]);

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
      pendingReturns,
      // اتجاه آخر ٣٠ يوماً مقابل الـ ٣٠ السابقة
      gmv30: Number(cur30._sum.total ?? 0),
      gmvPrev30: Number(prev30._sum.total ?? 0),
      orders30: cur30._count,
      ordersPrev30: prev30._count,
      salesSeries,
      topVendors,
      catalog: {
        storesApproved,
        storesVerified,
        storesLocated,
        newStores7,
        offersActive,
        outOfStock,
        activeProducts: toMap(productsByStatus)["ACTIVE"] ?? 0,
      },
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        total: Number(o.total),
        vendor: o.vendor.storeName,
        placedAt: o.placedAt,
      })),
    };
  }),

  // ── ملخّص مالي/محاسبي (بفلتر زمني) ──
  financeSummary: adminPerm("finance")
    .input(z.object({ period: z.enum(["today", "7d", "30d", "all"]).default("30d"), governorateId: z.string().cuid().optional() }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      let since: Date | null = null;
      if (input.period === "today") since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      else if (input.period === "7d") since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else if (input.period === "30d") since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // فلتر المحافظة (مدير المحافظة مقيّد؛ العامّ يختار). الطلبات تُفلتر عبر بائعها.
      const gov = ctx.user.scopeGovernorateId ?? input.governorateId ?? undefined;
      const oGov = gov ? { vendor: { governorateId: gov } } : {};

      // الإيراد يُعترف به على الطلبات المُنجزة (مسلّمة/مكتملة) ضمن الفترة.
      const realizedWhere = {
        status: { in: ["DELIVERED", "COMPLETED"] as OrderStatus[] },
        ...(since ? { placedAt: { gte: since } } : {}),
        ...oGov,
      };
      const [agg, unsettled, settledAgg] = await Promise.all([
        ctx.prisma.order.aggregate({
          where: realizedWhere,
          _sum: { subtotal: true, deliveryFee: true, commissionAmount: true, total: true },
          _count: true,
        }),
        // الرصيد المستحق للبائعين (غير مسوّى) — رصيد لحظي لا يتقيّد بالفترة.
        ctx.prisma.commission.findMany({
          where: { payoutId: null, order: { status: { in: ["DELIVERED", "COMPLETED"] }, ...oGov } },
          include: { order: { select: { subtotal: true } } },
        }),
        ctx.prisma.payout.aggregate({ where: { status: "PAID", ...(gov ? { vendor: { governorateId: gov } } : {}) }, _sum: { amount: true } }),
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

  /** تصدير طلبات الفترة كـ CSV (للمحاسبة). يشمل رأس BOM ليُقرأ العربي في Excel. */
  exportOrdersCsv: adminPerm("finance")
    .input(z.object({ period: z.enum(["today", "7d", "30d", "all"]).default("30d") }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      let since: Date | null = null;
      if (input.period === "today") since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      else if (input.period === "7d") since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else if (input.period === "30d") since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const orders = await ctx.prisma.order.findMany({
        where: since ? { placedAt: { gte: since } } : {},
        orderBy: { placedAt: "desc" },
        take: 5000,
        include: { vendor: { select: { storeName: true } } },
      });

      const STATUS_AR: Record<string, string> = {
        PENDING: "بانتظار التأكيد",
        CONFIRMED: "مؤكّد",
        PREPARING: "قيد التحضير",
        SHIPPED: "مشحون",
        DELIVERED: "مُسلّم",
        COMPLETED: "مكتمل",
        CANCELLED: "ملغى",
        RETURNED: "مُرتجع",
      };
      const esc = (v: string | number) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const headers = [
        "رقم الطلب",
        "التاريخ",
        "المتجر",
        "الحالة",
        "المجموع",
        "الخصم",
        "الكوبون",
        "التوصيل",
        "العمولة",
        "الإجمالي",
      ];
      const rows = orders.map((o) =>
        [
          o.number,
          o.placedAt.toISOString().slice(0, 16).replace("T", " "),
          o.vendor.storeName,
          STATUS_AR[o.status] ?? o.status,
          Number(o.subtotal),
          Number(o.discount),
          o.couponCode ?? "",
          Number(o.deliveryFee),
          Number(o.commissionAmount),
          Number(o.total),
        ]
          .map(esc)
          .join(","),
      );
      const csv = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      return { filename: `orders-${input.period}-${now.toISOString().slice(0, 10)}.csv`, csv, count: orders.length };
    }),

  // ── البائعون ──
  vendors: adminPerm("vendors")
    .input(z.object({ status: z.string().optional(), search: z.string().trim().max(60).optional(), governorateId: z.string().cuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: Prisma.VendorProfileWhereInput = {};
      if (input?.status) where.status = input.status as Prisma.EnumVendorStatusFilter["equals"];
      if (input?.search) where.storeName = { contains: input.search, mode: "insensitive" };
      // مدير المحافظة مقيّدٌ بمحافظته؛ المدير العامّ يفلتر بأيّ محافظةٍ اختارها.
      const gov = ctx.user.scopeGovernorateId ?? input?.governorateId;
      if (gov) where.governorateId = gov;
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
  vendorDetail: adminPerm("vendors").input(z.object({ id: z.string().cuid() })).query(async ({ ctx, input }) => {
    const v = await ctx.prisma.vendorProfile.findUnique({
      where: { id: input.id },
      include: {
        user: { select: { phone: true, name: true } },
        governorate: { select: { nameAr: true } },
        _count: { select: { products: true, orders: true } },
      },
    });
    if (!v) throw new TRPCError({ code: "NOT_FOUND", message: "البائع غير موجود" });
    assertVendorInScope(ctx.user, v.governorateId);

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

  // طلبات متجر معيّن: الحالية (قيد التنفيذ) أو السابقة (منتهية)، للوحة الأدمن.
  vendorOrders: adminPerm("vendors")
    .input(z.object({ vendorId: z.string().cuid(), scope: z.enum(["current", "past"]).default("current") }))
    .query(async ({ ctx, input }) => {
      await assertVendorIdInScope(ctx.prisma, ctx.user, input.vendorId);
      const CURRENT = ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED"] as OrderStatus[];
      const PAST = ["DELIVERED", "COMPLETED", "CANCELLED", "RETURNED"] as OrderStatus[];
      const orders = await ctx.prisma.order.findMany({
        where: { vendorId: input.vendorId, status: { in: input.scope === "current" ? CURRENT : PAST } },
        orderBy: { placedAt: "desc" },
        take: 50,
        select: {
          id: true,
          number: true,
          status: true,
          subtotal: true,
          total: true,
          placedAt: true,
          _count: { select: { items: true } },
        },
      });
      return orders.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        subtotal: Number(o.subtotal),
        total: Number(o.total),
        placedAt: o.placedAt,
        itemCount: o._count.items,
      }));
    }),

  // تقرير مالي لمتجر معيّن بفترة زمنية متغيّرة (لصفحة المتجر في الأدمن).
  vendorFinance: adminPerm("vendors")
    .input(z.object({ vendorId: z.string().cuid(), period: z.enum(["today", "7d", "30d", "all"]).default("30d") }))
    .query(async ({ ctx, input }) => {
      await assertVendorIdInScope(ctx.prisma, ctx.user, input.vendorId);
      const since = periodSince(input.period);
      const realized = { in: ["DELIVERED", "COMPLETED"] as OrderStatus[] };
      const [agg, pendingAgg] = await Promise.all([
        ctx.prisma.order.aggregate({
          where: { vendorId: input.vendorId, status: realized, ...(since ? { placedAt: { gte: since } } : {}) },
          _sum: { subtotal: true, commissionAmount: true, deliveryFee: true },
          _count: true,
        }),
        ctx.prisma.order.aggregate({
          where: {
            vendorId: input.vendorId,
            status: { in: ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED"] as OrderStatus[] },
            ...(since ? { placedAt: { gte: since } } : {}),
          },
          _sum: { subtotal: true },
          _count: true,
        }),
      ]);
      const grossSales = Number(agg._sum.subtotal ?? 0);
      const commission = Number(agg._sum.commissionAmount ?? 0);
      const deliveryRevenue = Number(agg._sum.deliveryFee ?? 0);
      const realizedOrders = agg._count;
      return {
        period: input.period,
        grossSales,
        commission,
        netToVendor: grossSales - commission,
        deliveryRevenue,
        realizedOrders,
        avgOrderValue: realizedOrders > 0 ? grossSales / realizedOrders : 0,
        pendingSales: Number(pendingAgg._sum.subtotal ?? 0),
        pendingOrders: pendingAgg._count,
      };
    }),

  reviewVendor: adminPerm("vendors").input(vendorReviewSchema).mutation(async ({ ctx, input }) => {
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
  pendingProducts: adminPerm("products").query(async ({ ctx }) => {
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

  reviewProduct: adminPerm("products").input(productReviewSchema).mutation(async ({ ctx, input }) => {
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
  vendorProducts: adminPerm("vendors").input(z.object({ vendorId: z.string().cuid() })).query(async ({ ctx, input }) => {
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
  setVendorCommission: adminPerm("vendors")
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
  categories: adminPerm("categories").query(async ({ ctx }) => {
    const cats = await ctx.prisma.category.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
      include: { _count: { select: { products: true, children: true } } },
    });
    return cats.map((c) => ({
      id: c.id,
      nameAr: c.nameAr,
      slug: c.slug,
      icon: c.icon,
      imageUrl: c.imageUrl,
      parentId: c.parentId,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      commissionRate: c.commissionRate === null ? null : Number(c.commissionRate),
      products: c._count.products,
      children: c._count.children,
    }));
  }),

  createCategory: adminPerm("categories").input(categoryCreateSchema).mutation(async ({ ctx, input }) => {
    const slug = `${slugify(input.nameAr)}-${Math.random().toString(36).slice(2, 6)}`;
    const cat = await ctx.prisma.category.create({
      data: {
        nameAr: input.nameAr,
        slug,
        icon: input.icon,
        imageUrl: input.imageUrl ?? null,
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

  updateCategory: adminPerm("categories").input(categoryUpdateSchema).mutation(async ({ ctx, input }) => {
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

  // إعادة ترتيب فئاتٍ ضمن نفس المستوى: sortOrder = موضع المعرّف في القائمة.
  reorderCategories: adminPerm("categories").input(categoryReorderSchema).mutation(async ({ ctx, input }) => {
    await ctx.prisma.$transaction(
      input.ids.map((id, i) => ctx.prisma.category.update({ where: { id }, data: { sortOrder: i } })),
    );
    await writeAudit(ctx.prisma, { actorId: ctx.user.id, action: "category.reorder", entityType: "Category", entityId: input.ids[0] ?? "", after: { ids: input.ids }, ip: ctx.reqIp });
    return { ok: true };
  }),

  removeCategory: adminPerm("categories")
    .input(z.object({ id: z.string().cuid(), reassignToId: z.string().cuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      const all = await ctx.prisma.category.findMany({ select: { id: true, parentId: true, nameAr: true } });
      const target = all.find((c) => c.id === input.id);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "الفئة غير موجودة" });

      // اجمع الفئة وكل نسلها بترتيب المستويات (لحذف الأعمق أولاً — قيد المفتاح الأجنبي).
      const childrenOf = new Map<string, string[]>();
      for (const c of all) {
        if (c.parentId) (childrenOf.get(c.parentId) ?? childrenOf.set(c.parentId, []).get(c.parentId)!).push(c.id);
      }
      const levels: string[][] = [];
      let level = [input.id];
      while (level.length) {
        levels.push(level);
        level = level.flatMap((id) => childrenOf.get(id) ?? []);
      }
      const subtree = levels.flat();
      const subtreeSet = new Set(subtree);

      // نقل منتجات الشجرة كلها إلى فئة وجهة قبل الحذف (المنتج يتطلّب فئة).
      const productCount = await ctx.prisma.product.count({ where: { categoryId: { in: subtree } } });
      if (productCount > 0) {
        const dest = input.reassignToId ?? target.parentId ?? undefined;
        if (!dest || subtreeSet.has(dest) || !all.some((c) => c.id === dest)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `تحتوي هذه الفئة على ${productCount} منتج — اختر فئة لنقلها إليها قبل الحذف`,
          });
        }
        await ctx.prisma.product.updateMany({ where: { categoryId: { in: subtree } }, data: { categoryId: dest } });
      }

      // حذف من الأعمق إلى الجذر (احترام قيد الفئة الأصل).
      for (let i = levels.length - 1; i >= 0; i--) {
        await ctx.prisma.category.deleteMany({ where: { id: { in: levels[i]! } } });
      }

      await writeAudit(ctx.prisma, {
        actorId: ctx.user.id,
        action: "category.delete",
        entityType: "Category",
        entityId: input.id,
        before: { nameAr: target.nameAr, deletedCount: subtree.length, movedProducts: productCount },
        ip: ctx.reqIp,
      });
      return { ok: true, deletedCount: subtree.length, movedProducts: productCount };
    }),

  // ── الكوبونات ──
  coupons: adminPerm("coupons").query(async ({ ctx }) => {
    const list = await ctx.prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
    return list.map((c) => ({
      id: c.id,
      code: c.code,
      type: c.type,
      value: Number(c.value),
      minSubtotal: Number(c.minSubtotal),
      maxDiscount: c.maxDiscount === null ? null : Number(c.maxDiscount),
      usageLimit: c.usageLimit,
      usedCount: c.usedCount,
      expiresAt: c.expiresAt,
      isActive: c.isActive,
    }));
  }),

  createCoupon: adminPerm("coupons").input(couponCreateSchema).mutation(async ({ ctx, input }) => {
    const exists = await ctx.prisma.coupon.findUnique({ where: { code: input.code } });
    if (exists) throw new TRPCError({ code: "BAD_REQUEST", message: "الرمز مستخدم مسبقاً" });
    const coupon = await ctx.prisma.coupon.create({
      data: {
        code: input.code,
        type: input.type,
        value: new Prisma.Decimal(input.value),
        minSubtotal: new Prisma.Decimal(input.minSubtotal),
        maxDiscount: input.maxDiscount === undefined ? null : new Prisma.Decimal(input.maxDiscount),
        usageLimit: input.usageLimit ?? null,
        expiresAt: input.expiresAt ?? null,
      },
    });
    await writeAudit(ctx.prisma, {
      actorId: ctx.user.id,
      action: "coupon.create",
      entityType: "Coupon",
      entityId: coupon.id,
      after: { code: coupon.code, type: coupon.type, value: input.value },
      ip: ctx.reqIp,
    });
    return { id: coupon.id };
  }),

  toggleCoupon: adminPerm("coupons").input(couponToggleSchema).mutation(async ({ ctx, input }) => {
    await ctx.prisma.coupon.update({ where: { id: input.id }, data: { isActive: input.isActive } });
    await writeAudit(ctx.prisma, {
      actorId: ctx.user.id,
      action: input.isActive ? "coupon.enable" : "coupon.disable",
      entityType: "Coupon",
      entityId: input.id,
      ip: ctx.reqIp,
    });
    return { ok: true };
  }),

  // ── الطلبات والنزاعات ──
  orders: adminPerm("orders")
    .input(
      z
        .object({
          status: z.string().optional(),
          search: z.string().trim().max(60).optional(),
          limit: z.number().int().min(1).max(100).default(50),
          governorateId: z.string().cuid().optional(),
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
      // مدير المحافظة مقيّدٌ بمحافظته؛ المدير العامّ يفلتر بأيّ محافظة.
      const gov = ctx.user.scopeGovernorateId ?? input?.governorateId;
      if (gov) where.vendor = { governorateId: gov };
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
  orderDetail: adminPerm("orders").input(z.object({ id: z.string().cuid() })).query(async ({ ctx, input }) => {
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
  forceOrderStatus: adminPerm("orders")
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
  payoutBalances: adminPerm("finance").query(async ({ ctx }) => {
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

  settlePayout: adminPerm("finance").input(z.object({ vendorId: z.string().cuid() })).mutation(async ({ ctx, input }) => {
    const result = await settleVendorPayout(ctx.prisma, { vendorId: input.vendorId, adminId: ctx.user.id, ip: ctx.reqIp });
    if (!result) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يوجد رصيد مستحق للتسوية" });
    return result;
  }),

  payoutHistory: adminPerm("finance").query(async ({ ctx }) => {
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
  users: adminPerm("users")
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

  manageUser: adminPerm("users").input(userManageSchema).mutation(async ({ ctx, input }) => {
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
  getSettings: adminPerm("settings").query(async ({ ctx }) => {
    const settings = await ctx.prisma.platformSetting.findMany();
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    const byGov = map.delivery_fees_by_gov;
    return {
      commissionRate: typeof map.commission_rate === "number" ? map.commission_rate : 0.1,
      deliveryFee: typeof map.delivery_fee === "number" ? map.delivery_fee : 5000,
      deliveryFeesByGov: (byGov && typeof byGov === "object" ? byGov : {}) as Record<string, number>,
      minOrderValue: typeof map.min_order_value === "number" ? map.min_order_value : 0,
    };
  }),

  updateSettings: adminPerm("settings").input(platformSettingsSchema).mutation(async ({ ctx, input }) => {
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
    if (input.minOrderValue !== undefined) {
      ops.push(
        ctx.prisma.platformSetting.upsert({
          where: { key: "min_order_value" },
          update: { value: input.minOrderValue },
          create: { key: "min_order_value", value: input.minOrderValue },
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

  // مظهر التطبيق — ألوان الثيم وترتيب أقسام الرئيسية (لوحة «المظهر»).
  getAppearance: adminPerm("settings").query(async ({ ctx }) => {
    const row = await ctx.prisma.platformSetting.findUnique({ where: { key: "appearance" } });
    return (row?.value ?? null) as unknown;
  }),
  updateAppearance: adminPerm("settings").input(appearanceSchema).mutation(async ({ ctx, input }) => {
    const hex = (c: string) => (c.startsWith("#") ? c : `#${c}`);
    const value = {
      colors: {
        primary: hex(input.colors.primary),
        accent: hex(input.colors.accent),
        surface: hex(input.colors.surface),
        live: hex(input.colors.live),
      },
      sections: input.sections,
      services: input.services,
      sectionTitles: input.sectionTitles ?? {},
      serviceLabels: input.serviceLabels ?? {},
    };
    await ctx.prisma.platformSetting.upsert({
      where: { key: "appearance" },
      update: { value },
      create: { key: "appearance", value },
    });
    await writeAudit(ctx.prisma, {
      actorId: ctx.user.id,
      action: "appearance.update",
      entityType: "PlatformSetting",
      entityId: "appearance",
      after: value,
      ip: ctx.reqIp,
    });
    return { ok: true };
  }),

  // ── المحافظات: العرض والتحكّم (لوحة «المظهر» ← تبويب المحافظات) ──
  govList: adminPerm("settings").query(async ({ ctx }) => {
    const rows = await ctx.prisma.governorate.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        nameAr: true,
        code: true,
        sortOrder: true,
        enabled: true,
        tagline: true,
        heroImageUrl: true,
        souks: true,
        _count: { select: { vendors: true, ads: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      nameAr: r.nameAr,
      code: r.code,
      sortOrder: r.sortOrder,
      enabled: r.enabled,
      tagline: r.tagline,
      heroImageUrl: r.heroImageUrl,
      souks: (r.souks as { label: string; q: string; img?: string; emoji?: string; color?: string; status?: "active" | "hidden" }[] | null) ?? [],
      vendorCount: r._count.vendors,
      adCount: r._count.ads,
    }));
  }),

  updateGovernorate: adminPerm("settings").input(governoratePresentationSchema).mutation(async ({ ctx, input }) => {
    const data: Prisma.GovernorateUpdateInput = {};
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.tagline !== undefined) data.tagline = input.tagline;
    if (input.heroImageUrl !== undefined) data.heroImageUrl = input.heroImageUrl;
    if (input.souks !== undefined) data.souks = input.souks ?? Prisma.DbNull;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    const gov = await ctx.prisma.governorate.update({ where: { id: input.id }, data });
    await writeAudit(ctx.prisma, {
      actorId: ctx.user.id,
      action: "governorate.update",
      entityType: "Governorate",
      entityId: gov.id,
      after: input,
      ip: ctx.reqIp,
    });
    return { ok: true };
  }),

  // ── الإعلانات: CRUD (لوحة «المظهر» ← تبويب الإعلانات) ──
  adList: adminPerm("settings").query(async ({ ctx }) => {
    const rows = await ctx.prisma.ad.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { governorate: { select: { nameAr: true } } },
    });
    return rows.map((a) => ({
      id: a.id,
      title: a.title,
      subtitle: a.subtitle,
      imageUrl: a.imageUrl,
      linkUrl: a.linkUrl,
      placement: a.placement,
      active: a.active,
      sortOrder: a.sortOrder,
      governorateId: a.governorateId,
      governorateName: a.governorate?.nameAr ?? null,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
    }));
  }),

  createAd: adminPerm("settings").input(adCreateSchema).mutation(async ({ ctx, input }) => {
    const ad = await ctx.prisma.ad.create({
      data: {
        title: input.title,
        subtitle: input.subtitle ?? null,
        imageUrl: input.imageUrl,
        linkUrl: input.linkUrl,
        placement: input.placement,
        active: input.active,
        sortOrder: input.sortOrder,
        governorateId: input.governorateId ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
      },
    });
    await writeAudit(ctx.prisma, {
      actorId: ctx.user.id,
      action: "ad.create",
      entityType: "Ad",
      entityId: ad.id,
      after: input,
      ip: ctx.reqIp,
    });
    return { id: ad.id };
  }),

  updateAd: adminPerm("settings").input(adUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id, ...rest } = input;
    const data: Prisma.AdUpdateInput = {};
    if (rest.title !== undefined) data.title = rest.title;
    if (rest.subtitle !== undefined) data.subtitle = rest.subtitle ?? null;
    if (rest.imageUrl !== undefined) data.imageUrl = rest.imageUrl;
    if (rest.linkUrl !== undefined) data.linkUrl = rest.linkUrl;
    if (rest.placement !== undefined) data.placement = rest.placement;
    if (rest.active !== undefined) data.active = rest.active;
    if (rest.sortOrder !== undefined) data.sortOrder = rest.sortOrder;
    if (rest.startsAt !== undefined) data.startsAt = rest.startsAt ?? null;
    if (rest.endsAt !== undefined) data.endsAt = rest.endsAt ?? null;
    if (rest.governorateId !== undefined) {
      data.governorate = rest.governorateId
        ? { connect: { id: rest.governorateId } }
        : { disconnect: true };
    }
    await ctx.prisma.ad.update({ where: { id }, data });
    await writeAudit(ctx.prisma, {
      actorId: ctx.user.id,
      action: "ad.update",
      entityType: "Ad",
      entityId: id,
      after: input,
      ip: ctx.reqIp,
    });
    return { ok: true };
  }),

  deleteAd: adminPerm("settings").input(adDeleteSchema).mutation(async ({ ctx, input }) => {
    await ctx.prisma.ad.delete({ where: { id: input.id } });
    await writeAudit(ctx.prisma, {
      actorId: ctx.user.id,
      action: "ad.delete",
      entityType: "Ad",
      entityId: input.id,
      ip: ctx.reqIp,
    });
    return { ok: true };
  }),

  // ── المحتوى التحريريّ: CRUD (لوحة «المظهر» ← تبويب المحتوى) ──
  articleList: adminPerm("settings").query(async ({ ctx }) => {
    return ctx.prisma.article.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
  }),
  upsertArticle: adminPerm("settings").input(articleUpsertSchema).mutation(async ({ ctx, input }) => {
    const data = {
      slug: input.slug,
      kind: input.kind,
      title: input.title,
      excerpt: input.excerpt ?? null,
      coverUrl: input.coverUrl ?? null,
      body: input.body,
      active: input.active,
      sortOrder: input.sortOrder,
    };
    const a = input.id
      ? await ctx.prisma.article.update({ where: { id: input.id }, data })
      : await ctx.prisma.article.create({ data });
    await writeAudit(ctx.prisma, { actorId: ctx.user.id, action: input.id ? "article.update" : "article.create", entityType: "Article", entityId: a.id, ip: ctx.reqIp });
    return { id: a.id };
  }),
  deleteArticle: adminPerm("settings").input(articleDeleteSchema).mutation(async ({ ctx, input }) => {
    await ctx.prisma.article.delete({ where: { id: input.id } });
    await writeAudit(ctx.prisma, { actorId: ctx.user.id, action: "article.delete", entityType: "Article", entityId: input.id, ip: ctx.reqIp });
    return { ok: true };
  }),

  // ── إدارة المتاجر (لوحة «المظهر» ← تبويب المتاجر): شخصيّة + أقسام + نبض ──
  storeList: adminPerm("settings")
    .input(z.object({ governorateId: z.string().cuid().optional(), q: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: Prisma.VendorProfileWhereInput = { status: "APPROVED" };
      if (input?.governorateId) where.governorateId = input.governorateId;
      if (input?.q) where.slugNorm = { contains: normalizeArabic(input.q) };
      const vendors = await ctx.prisma.vendorProfile.findMany({
        where,
        orderBy: [{ governorateId: "asc" }, { storeName: "asc" }],
        select: {
          id: true, storeName: true, slug: true, logoUrl: true, verified: true,
          ratingAvg: true, ratingCount: true, ordersCount: true, plan: true, featuredUntil: true,
          governorate: { select: { nameAr: true } },
          _count: { select: { products: true, sections: true, activities: true } },
        },
      });
      const now = Date.now();
      return vendors.map((v) => ({
        id: v.id, storeName: v.storeName, slug: v.slug, logoUrl: v.logoUrl, verified: v.verified,
        ratingAvg: Number(v.ratingAvg), ratingCount: v.ratingCount, ordersCount: v.ordersCount,
        plan: v.plan, featured: v.featuredUntil != null && v.featuredUntil.getTime() > now,
        governorate: v.governorate?.nameAr ?? null,
        productCount: v._count.products, sectionCount: v._count.sections, activityCount: v._count.activities,
      }));
    }),

  storeGet: adminPerm("settings").input(idSchema).query(async ({ ctx, input }) => {
    const v = await ctx.prisma.vendorProfile.findUnique({
      where: { id: input.id },
      select: {
        id: true, storeName: true, slug: true, description: true, logoUrl: true, bannerUrl: true,
        verified: true, establishedYear: true, responseMins: true, opensAt: true, closesAt: true,
        deliveryInfo: true, addressText: true, ordersCount: true, latitude: true, longitude: true,
        ratingAvg: true, ratingCount: true, plan: true, planExpiresAt: true, featuredUntil: true,
        governorate: { select: { nameAr: true } },
        sections: { orderBy: { sortOrder: "asc" }, select: { id: true, nameAr: true, icon: true, sortOrder: true, _count: { select: { products: true } } } },
        activities: { orderBy: { createdAt: "desc" }, select: { id: true, kind: true, message: true, sponsored: true, createdAt: true } },
      },
    });
    if (!v) throw new TRPCError({ code: "NOT_FOUND", message: "المتجر غير موجود" });
    return {
      ...v,
      ratingAvg: Number(v.ratingAvg),
      planExpiresAt: v.planExpiresAt ? v.planExpiresAt.toISOString() : null,
      featuredUntil: v.featuredUntil ? v.featuredUntil.toISOString() : null,
      governorate: v.governorate?.nameAr ?? null,
      sections: v.sections.map((s) => ({ id: s.id, nameAr: s.nameAr, icon: s.icon, sortOrder: s.sortOrder, productCount: s._count.products })),
      activities: v.activities.map((a) => ({ id: a.id, kind: a.kind, message: a.message, sponsored: a.sponsored, at: a.createdAt.toISOString() })),
    };
  }),

  updateStoreProfile: adminPerm("settings").input(storeProfileUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id, ...rest } = input;
    const data: Prisma.VendorProfileUpdateInput = {};
    if (rest.description !== undefined) data.description = rest.description ?? null;
    if (rest.logoUrl !== undefined) data.logoUrl = rest.logoUrl ?? null;
    if (rest.bannerUrl !== undefined) data.bannerUrl = rest.bannerUrl ?? null;
    if (rest.verified !== undefined) data.verified = rest.verified;
    if (rest.establishedYear !== undefined) data.establishedYear = rest.establishedYear ?? null;
    if (rest.responseMins !== undefined) data.responseMins = rest.responseMins ?? null;
    if (rest.opensAt !== undefined) data.opensAt = rest.opensAt ?? null;
    if (rest.closesAt !== undefined) data.closesAt = rest.closesAt ?? null;
    if (rest.deliveryInfo !== undefined) data.deliveryInfo = rest.deliveryInfo ?? null;
    if (rest.addressText !== undefined) data.addressText = rest.addressText ?? null;
    if (rest.ordersCount !== undefined) data.ordersCount = rest.ordersCount;
    if (rest.latitude !== undefined) data.latitude = rest.latitude ?? null;
    if (rest.longitude !== undefined) data.longitude = rest.longitude ?? null;
    if (rest.ratingAvg !== undefined) data.ratingAvg = new Prisma.Decimal(rest.ratingAvg);
    if (rest.ratingCount !== undefined) data.ratingCount = rest.ratingCount;
    await ctx.prisma.vendorProfile.update({ where: { id }, data });
    await writeAudit(ctx.prisma, { actorId: ctx.user.id, action: "store.profile.update", entityType: "VendorProfile", entityId: id, ip: ctx.reqIp });
    return { ok: true };
  }),

  // أقسام المتجر (المدير يديرها لأيّ متجر)
  storeSectionUpsert: adminPerm("settings").input(adminSectionUpsertSchema).mutation(async ({ ctx, input }) => {
    if (input.id) {
      await ctx.prisma.vendorSection.update({ where: { id: input.id }, data: { nameAr: input.nameAr, icon: input.icon ?? null } });
      return { id: input.id };
    }
    const count = await ctx.prisma.vendorSection.count({ where: { vendorId: input.vendorId } });
    const created = await ctx.prisma.vendorSection.create({
      data: { vendorId: input.vendorId, nameAr: input.nameAr, slug: `${slugify(input.nameAr)}-${Math.random().toString(36).slice(2, 6)}`, icon: input.icon ?? null, sortOrder: count },
    });
    return { id: created.id };
  }),
  storeSectionDelete: adminPerm("settings").input(idSchema).mutation(async ({ ctx, input }) => {
    await ctx.prisma.vendorSection.delete({ where: { id: input.id } });
    return { ok: true };
  }),
  storeSectionReorder: adminPerm("settings").input(adminSectionReorderSchema).mutation(async ({ ctx, input }) => {
    const owned = await ctx.prisma.vendorSection.findMany({ where: { vendorId: input.vendorId }, select: { id: true } });
    const ownedIds = new Set(owned.map((s) => s.id));
    if (!input.orderedIds.every((id) => ownedIds.has(id))) throw new TRPCError({ code: "BAD_REQUEST", message: "قسمٌ لا يخصّ المتجر" });
    await ctx.prisma.$transaction(input.orderedIds.map((id, i) => ctx.prisma.vendorSection.update({ where: { id }, data: { sortOrder: i } })));
    return { ok: true };
  }),

  // نبض السوق — أحداث المتجر
  storeActivityUpsert: adminPerm("settings").input(storeActivityUpsertSchema).mutation(async ({ ctx, input }) => {
    const createdAt = input.minutesAgo != null ? new Date(Date.now() - input.minutesAgo * 60_000) : undefined;
    if (input.id) {
      await ctx.prisma.storeActivity.update({
        where: { id: input.id },
        data: { kind: input.kind, message: input.message, ...(input.sponsored !== undefined ? { sponsored: input.sponsored } : {}), ...(createdAt ? { createdAt } : {}) },
      });
      return { id: input.id };
    }
    const created = await ctx.prisma.storeActivity.create({
      data: { vendorId: input.vendorId, kind: input.kind, message: input.message, sponsored: input.sponsored ?? false, ...(createdAt ? { createdAt } : {}) },
    });
    return { id: created.id };
  }),
  storeActivityDelete: adminPerm("settings").input(idSchema).mutation(async ({ ctx, input }) => {
    await ctx.prisma.storeActivity.delete({ where: { id: input.id } });
    return { ok: true };
  }),

  // ── تحصيل الدخل: طبقات الاشتراك (تعريفٌ قابلٌ للتعديل) + تعيين طبقة/ظهور متجر ──
  getVendorPlans: adminPerm("settings").query(async ({ ctx }) => {
    const row = await ctx.prisma.platformSetting.findUnique({ where: { key: "vendor_plans" } });
    return normalizePlansConfig(row?.value);
  }),
  updateVendorPlans: adminPerm("settings").input(vendorPlansConfigSchema).mutation(async ({ ctx, input }) => {
    const value = normalizePlansConfig(input) as unknown as Prisma.InputJsonValue;
    await ctx.prisma.platformSetting.upsert({
      where: { key: "vendor_plans" },
      update: { value },
      create: { key: "vendor_plans", value },
    });
    await writeAudit(ctx.prisma, { actorId: ctx.user.id, action: "plans.update", entityType: "PlatformSetting", entityId: "vendor_plans", ip: ctx.reqIp });
    return { ok: true };
  }),
  setStorePlan: adminPerm("settings").input(setStorePlanSchema).mutation(async ({ ctx, input }) => {
    const data: Prisma.VendorProfileUpdateInput = {};
    if (input.plan !== undefined) data.plan = input.plan;
    if (input.planExpiresAt !== undefined) data.planExpiresAt = input.planExpiresAt ? new Date(input.planExpiresAt) : null;
    if (input.featuredUntil !== undefined) data.featuredUntil = input.featuredUntil ? new Date(input.featuredUntil) : null;
    await ctx.prisma.vendorProfile.update({ where: { id: input.id }, data });
    await writeAudit(ctx.prisma, { actorId: ctx.user.id, action: "store.plan.update", entityType: "VendorProfile", entityId: input.id, ip: ctx.reqIp });
    return { ok: true };
  }),

  // ── الأسواق: CRUD (لوحة «المظهر» ← تبويب الأسواق) ──
  marketList: adminPerm("settings").query(async ({ ctx }) => {
    return ctx.prisma.market.findMany({ orderBy: { sortOrder: "asc" } });
  }),
  createMarket: adminPerm("settings").input(marketCreateSchema).mutation(async ({ ctx, input }) => {
    const m = await ctx.prisma.market.create({
      data: {
        slug: input.slug,
        nameAr: input.nameAr,
        tagline: input.tagline ?? null,
        imageUrl: input.imageUrl ?? null,
        icon: input.icon ?? null,
        kind: input.kind,
        categorySlug: input.categorySlug ?? null,
        channel: input.channel ?? null,
        href: input.href ?? null,
        status: input.status,
        enabled: input.enabled,
        sortOrder: input.sortOrder,
      },
    });
    await writeAudit(ctx.prisma, { actorId: ctx.user.id, action: "market.create", entityType: "Market", entityId: m.id, after: input, ip: ctx.reqIp });
    return { id: m.id };
  }),
  updateMarket: adminPerm("settings").input(marketUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id, ...rest } = input;
    const data: Prisma.MarketUpdateInput = {};
    if (rest.slug !== undefined) data.slug = rest.slug;
    if (rest.nameAr !== undefined) data.nameAr = rest.nameAr;
    if (rest.tagline !== undefined) data.tagline = rest.tagline ?? null;
    if (rest.imageUrl !== undefined) data.imageUrl = rest.imageUrl ?? null;
    if (rest.icon !== undefined) data.icon = rest.icon ?? null;
    if (rest.kind !== undefined) data.kind = rest.kind;
    if (rest.categorySlug !== undefined) data.categorySlug = rest.categorySlug ?? null;
    if (rest.channel !== undefined) data.channel = rest.channel ?? null;
    if (rest.href !== undefined) data.href = rest.href ?? null;
    if (rest.status !== undefined) data.status = rest.status;
    if (rest.enabled !== undefined) data.enabled = rest.enabled;
    if (rest.sortOrder !== undefined) data.sortOrder = rest.sortOrder;
    await ctx.prisma.market.update({ where: { id }, data });
    await writeAudit(ctx.prisma, { actorId: ctx.user.id, action: "market.update", entityType: "Market", entityId: id, after: input, ip: ctx.reqIp });
    return { ok: true };
  }),
  deleteMarket: adminPerm("settings").input(marketDeleteSchema).mutation(async ({ ctx, input }) => {
    await ctx.prisma.market.delete({ where: { id: input.id } });
    await writeAudit(ctx.prisma, { actorId: ctx.user.id, action: "market.delete", entityType: "Market", entityId: input.id, ip: ctx.reqIp });
    return { ok: true };
  }),
  // تخصيصُ عرض سوقٍ بعينه (ترتيب الأقسام/ظهورها/عناوينها) — تحكّمٌ كاملٌ لكلّ سوق.
  updateMarketDisplay: adminPerm("settings").input(marketDisplayUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id, ...rest } = input;
    // نُخزّن الأقسام والعناوين معاً في config؛ null على أيٍّ منهما = مسحه (يرث العامّ).
    const existing = await ctx.prisma.market.findUnique({ where: { id }, select: { config: true } });
    const cur = (existing?.config ?? {}) as { sections?: unknown; sectionTitles?: unknown };
    const next: Record<string, unknown> = { ...cur };
    if (rest.sections !== undefined) {
      if (rest.sections === null) delete next.sections;
      else next.sections = rest.sections;
    }
    if (rest.sectionTitles !== undefined) {
      if (rest.sectionTitles === null) delete next.sectionTitles;
      else next.sectionTitles = rest.sectionTitles;
    }
    const isEmpty = !next.sections && !next.sectionTitles;
    await ctx.prisma.market.update({ where: { id }, data: { config: isEmpty ? Prisma.DbNull : (next as Prisma.InputJsonValue) } });
    await writeAudit(ctx.prisma, { actorId: ctx.user.id, action: "market.display", entityType: "Market", entityId: id, after: input, ip: ctx.reqIp });
    return { ok: true };
  }),
  // إعادة ترتيب الأسواق دفعةً واحدة: sortOrder = موضع المعرّف في القائمة.
  reorderMarkets: adminPerm("settings").input(marketReorderSchema).mutation(async ({ ctx, input }) => {
    await ctx.prisma.$transaction(
      input.ids.map((id, i) => ctx.prisma.market.update({ where: { id }, data: { sortOrder: i } })),
    );
    await writeAudit(ctx.prisma, { actorId: ctx.user.id, action: "market.reorder", entityType: "Market", entityId: input.ids[0] ?? "", after: { ids: input.ids }, ip: ctx.reqIp });
    return { ok: true };
  }),

  // رابط رفعٍ موقّع للأدمن (صور المحافظات/الإعلانات) — يعمل عند تهيئة التخزين الكائنيّ.
  presignImage: adminPerm("settings").input(presignUploadSchema).mutation(async ({ ctx, input }) => {
    const storage = getStorage();
    if (!storage.configured) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "خدمة رفع الصور غير مهيّأة على الخادم" });
    }
    const prefix = `${input.purpose}/${ctx.user.id}`;
    return storage.presignUpload({ prefix, contentType: input.contentType });
  }),
  storageStatus: adminPerm("settings").query(() => ({ configured: getStorage().configured })),

  // ── سجل التدقيق ──
  auditLog: adminPerm("audit")
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

  // ── هويّة الأدمن الحالي (لتقييد التنقّل في الواجهة) ──
  me: adminProcedure.query(async ({ ctx }) => {
    const u = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: { id: true, name: true, phone: true, permissions: true, staffTitle: true, scopeGovernorateId: true },
    });
    return {
      id: ctx.user.id,
      name: u?.name ?? null,
      phone: ctx.user.phone,
      permissions: effectivePermissions(ctx.user.role, ctx.user.permissions),
      isSuper: isSuperAdmin(ctx.user.role, ctx.user.permissions),
      staffTitle: u?.staffTitle ?? null,
      scopeGovernorateId: u?.scopeGovernorateId ?? null,
    };
  }),

  // ── إدارة حسابات الموظفين (المدير العام فقط) ──
  staffList: adminPerm("staff").query(async ({ ctx }) => {
    const staff = await ctx.prisma.user.findMany({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        permissions: true,
        staffTitle: true,
        scopeGovernorateId: true,
        isBlocked: true,
      },
    });
    const govs = await ctx.prisma.governorate.findMany({ select: { id: true, nameAr: true } });
    const govMap = new Map(govs.map((g) => [g.id, g.nameAr]));
    return staff.map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      staffTitle: s.staffTitle,
      isBlocked: s.isBlocked,
      isSuper: s.permissions === null, // مدير عام قديم/رئيسي
      permissions: effectivePermissions("ADMIN", s.permissions),
      scopeGovernorateId: s.scopeGovernorateId,
      scopeGovernorate: s.scopeGovernorateId ? govMap.get(s.scopeGovernorateId) ?? null : null,
      isSelf: s.id === ctx.user.id,
    }));
  }),

  staffCreate: adminPerm("staff").input(staffCreateSchema).mutation(async ({ ctx, input }) => {
    const perms = sanitizePermissions(input.permissions);
    if (perms.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "صلاحيات غير صالحة" });

    // مستخدم موجود بنفس الهاتف → ترقيته لموظف؛ وإلا إنشاء حساب جديد.
    const existing = await ctx.prisma.user.findUnique({ where: { phone: input.phone } });
    if (existing && existing.role === "VENDOR") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الرقم لحساب بائع — لا يمكن تحويله لموظف" });
    }
    const data = {
      role: "ADMIN" as const,
      name: input.name,
      staffTitle: input.staffTitle ?? null,
      permissions: perms,
      scopeGovernorateId: input.scopeGovernorateId ?? null,
    };
    const user = existing
      ? await ctx.prisma.user.update({ where: { id: existing.id }, data })
      : await ctx.prisma.user.create({ data: { phone: input.phone, ...data } });

    await writeAudit(ctx.prisma, {
      actorId: ctx.user.id,
      action: existing ? "staff.upgrade" : "staff.create",
      entityType: "User",
      entityId: user.id,
      after: { name: input.name, staffTitle: input.staffTitle, permissions: perms },
      ip: ctx.reqIp,
    });
    return { id: user.id };
  }),

  staffUpdate: adminPerm("staff").input(staffUpdateSchema).mutation(async ({ ctx, input }) => {
    const target = await ctx.prisma.user.findUnique({ where: { id: input.userId } });
    if (!target || target.role !== "ADMIN") throw new TRPCError({ code: "NOT_FOUND", message: "الموظف غير موجود" });
    if (target.permissions === null && target.id !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن تعديل صلاحيات المدير العام الرئيسي" });
    }
    const data: { staffTitle?: string | null; permissions?: string[]; scopeGovernorateId?: string | null } = {};
    if (input.staffTitle !== undefined) data.staffTitle = input.staffTitle;
    if (input.scopeGovernorateId !== undefined) data.scopeGovernorateId = input.scopeGovernorateId;
    if (input.permissions !== undefined) {
      const perms = sanitizePermissions(input.permissions);
      if (perms.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "صلاحيات غير صالحة" });
      // منع المستخدم من إزالة صلاحية إدارة الموظفين عن نفسه (تفادي القفل خارج النظام).
      if (input.userId === ctx.user.id && !perms.includes("staff")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكنك إزالة صلاحية إدارة الموظفين عن نفسك" });
      }
      data.permissions = perms;
    }
    await ctx.prisma.user.update({ where: { id: input.userId }, data });
    await writeAudit(ctx.prisma, {
      actorId: ctx.user.id,
      action: "staff.update",
      entityType: "User",
      entityId: input.userId,
      after: data,
      ip: ctx.reqIp,
    });
    return { ok: true };
  }),

  // إلغاء صلاحيات موظف (إعادته مستخدماً عادياً) — لا يطال المدير العام الرئيسي أو الذات.
  staffRevoke: adminPerm("staff").input(z.object({ userId: z.string().cuid() })).mutation(async ({ ctx, input }) => {
    if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكنك إلغاء صلاحيات نفسك" });
    const target = await ctx.prisma.user.findUnique({ where: { id: input.userId } });
    if (!target || target.role !== "ADMIN") throw new TRPCError({ code: "NOT_FOUND", message: "الموظف غير موجود" });
    if (target.permissions === null) {
      throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن إلغاء المدير العام الرئيسي" });
    }
    await ctx.prisma.$transaction([
      ctx.prisma.user.update({
        where: { id: input.userId },
        data: { role: "CUSTOMER", permissions: Prisma.DbNull, staffTitle: null, scopeGovernorateId: null },
      }),
      ctx.prisma.session.updateMany({ where: { userId: input.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await writeAudit(ctx.prisma, {
      actorId: ctx.user.id,
      action: "staff.revoke",
      entityType: "User",
      entityId: input.userId,
      before: { staffTitle: target.staffTitle },
      ip: ctx.reqIp,
    });
    return { ok: true };
  }),
});

/** بداية الفترة الزمنية للتقارير المالية (null = كل الوقت). */
function periodSince(period: "today" | "7d" | "30d" | "all"): Date | null {
  const now = new Date();
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "7d") return new Date(now.getTime() - 7 * 86_400_000);
  if (period === "30d") return new Date(now.getTime() - 30 * 86_400_000);
  return null;
}

/** يمنع مدير المحافظة من الوصول إلى متجر خارج نطاق محافظته. */
function assertVendorInScope(user: { scopeGovernorateId: string | null }, vendorGovId: string | null): void {
  if (user.scopeGovernorateId && vendorGovId !== user.scopeGovernorateId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "هذا المتجر خارج نطاق محافظتك" });
  }
}

/** نسخة تجلب محافظة المتجر بالمعرّف ثم تتحقّق من النطاق (للإجراءات التي تستقبل vendorId فقط). */
async function assertVendorIdInScope(
  prisma: Context["prisma"],
  user: { scopeGovernorateId: string | null },
  vendorId: string,
): Promise<void> {
  if (!user.scopeGovernorateId) return;
  const v = await prisma.vendorProfile.findUnique({ where: { id: vendorId }, select: { governorateId: true } });
  assertVendorInScope(user, v?.governorateId ?? null);
}
