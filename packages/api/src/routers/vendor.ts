/**
 * راوتر لوحة البائع. كل العمليات مقيّدة بملكية البائع لبياناته (حماية IDOR).
 * يعيد استخدام آلة حالة الطلب وآثار المخزون من خدمة الطلبات.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { Prisma, type PrismaClient, type ProductStatus, type OrderStatus } from "@al-souq/db";
import { normalizeArabic, slugify } from "@al-souq/utils";
import {
  vendorRegisterSchema,
  vendorSettingsSchema,
  productCreateSchema,
  productUpdateSchema,
  orderStatusUpdateSchema,
} from "@al-souq/validators";
import { signAccessToken, authEnv } from "@al-souq/auth";
import { getStorage } from "@al-souq/storage";
import { router, protectedProcedure, vendorProcedure } from "../trpc";
import { setAccessCookie } from "../context";
import { changeOrderStatus } from "../services/order";

/**
 * عند تفعيل التخزين الكائني (S3/R2) نرفض صور data: — يجب الرفع عبر presign.
 * وضع data: يبقى مقبولاً فقط كمسار احتياطي حين لا يوجد تخزين مهيّأ.
 */
function assertImagesStorable(images: string[] | undefined) {
  if (!images || !getStorage().configured) return;
  if (images.some((u) => u.startsWith("data:"))) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "ارفع الصور عبر خدمة الرفع بدل تضمينها — أعد اختيار الصور",
    });
  }
}

/** يجلب ملف البائع للمستخدم الحالي أو يرمي خطأً. */
async function requireVendor(prisma: PrismaClient, userId: string) {
  const vendor = await prisma.vendorProfile.findUnique({ where: { userId } });
  if (!vendor) throw new TRPCError({ code: "FORBIDDEN", message: "لا يوجد ملف بائع" });
  return vendor;
}

function assertApproved(status: string) {
  if (status !== "APPROVED") {
    throw new TRPCError({ code: "FORBIDDEN", message: "حسابك قيد المراجعة — لا يمكن النشر بعد" });
  }
}

export const vendorRouter = router({
  // ── التسجيل (أي مستخدم مسجّل) ──
  register: protectedProcedure.input(vendorRegisterSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.vendorProfile.findUnique({ where: { userId: ctx.user.id } });
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "لديك ملف بائع بالفعل" });

    const baseSlug = slugify(input.storeName);
    const slug = `${baseSlug}-${ctx.user.id.slice(-5)}`;
    const vendor = await ctx.prisma.$transaction(async (tx) => {
      const v = await tx.vendorProfile.create({
        data: {
          userId: ctx.user.id,
          storeName: input.storeName,
          slug,
          slugNorm: normalizeArabic(input.storeName),
          description: input.description,
          governorateId: input.governorateId,
          status: "PENDING",
        },
      });
      await tx.user.update({ where: { id: ctx.user.id }, data: { role: "VENDOR" } });
      return v;
    });

    // إعادة إصدار توكن الوصول بدور VENDOR ليتعرّف عليه الـ middleware فوراً
    const accessToken = await signAccessToken({ sub: ctx.user.id, role: "VENDOR", phone: ctx.user.phone });
    setAccessCookie(ctx, accessToken, authEnv.accessTtl);

    return { id: vendor.id, status: vendor.status };
  }),

  me: vendorProcedure.query(async ({ ctx }) => {
    const vendor = await ctx.prisma.vendorProfile.findUnique({
      where: { userId: ctx.user.id },
      include: { governorate: { select: { id: true, nameAr: true } } },
    });
    if (!vendor) return null;
    return {
      id: vendor.id,
      storeName: vendor.storeName,
      slug: vendor.slug,
      description: vendor.description,
      logoUrl: vendor.logoUrl,
      bannerUrl: vendor.bannerUrl,
      status: vendor.status,
      rejectionNote: vendor.rejectionNote,
      governorate: vendor.governorate,
      latitude: vendor.latitude,
      longitude: vendor.longitude,
      ratingAvg: Number(vendor.ratingAvg),
      ratingCount: vendor.ratingCount,
      payoutDetails: vendor.payoutDetails,
    };
  }),

  updateSettings: vendorProcedure.input(vendorSettingsSchema).mutation(async ({ ctx, input }) => {
    const vendor = await requireVendor(ctx.prisma, ctx.user.id);
    const payoutDetails =
      input.payoutMethod || input.payoutAccount
        ? { method: input.payoutMethod ?? null, account: input.payoutAccount ?? null }
        : undefined;
    await ctx.prisma.vendorProfile.update({
      where: { id: vendor.id },
      data: {
        storeName: input.storeName,
        slugNorm: input.storeName ? normalizeArabic(input.storeName) : undefined,
        description: input.description,
        logoUrl: input.logoUrl || undefined,
        bannerUrl: input.bannerUrl || undefined,
        governorateId: input.governorateId,
        latitude: input.latitude === undefined ? undefined : input.latitude,
        longitude: input.longitude === undefined ? undefined : input.longitude,
        ...(payoutDetails ? { payoutDetails } : {}),
      },
    });
    return { ok: true };
  }),

  // ── المنتجات ──
  products: vendorProcedure
    .input(z.object({ q: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx.prisma, ctx.user.id);
      const where: Prisma.ProductWhereInput = { vendorId: vendor.id };
      if (input?.q) where.titleNorm = { contains: normalizeArabic(input.q) };
      if (input?.status) where.status = input.status as ProductStatus;
      const products = await ctx.prisma.product.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        include: {
          images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
          variants: { select: { stock: true, reservedStock: true } },
          category: { select: { nameAr: true } },
        },
      });
      return products.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        price: Number(p.basePrice),
        category: p.category.nameAr,
        image: p.images[0]?.url ?? null,
        soldCount: p.soldCount,
        totalStock: p.variants.reduce((s, v) => s + v.stock, 0),
        reserved: p.variants.reduce((s, v) => s + v.reservedStock, 0),
      }));
    }),

  productById: vendorProcedure.input(z.object({ id: z.string().cuid() })).query(async ({ ctx, input }) => {
    const vendor = await requireVendor(ctx.prisma, ctx.user.id);
    const product = await ctx.prisma.product.findFirst({
      where: { id: input.id, vendorId: vendor.id },
      include: { images: { orderBy: { sortOrder: "asc" } }, variants: { orderBy: { id: "asc" } } },
    });
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "المنتج غير موجود" });
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      categoryId: product.categoryId,
      basePrice: Number(product.basePrice),
      compareAtPrice: product.compareAtPrice != null ? Number(product.compareAtPrice) : null,
      status: product.status,
      images: product.images.map((i) => i.url),
      variants: product.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        attributes: v.attributes,
        price: Number(v.price),
        stock: v.stock,
        isActive: v.isActive,
      })),
    };
  }),

  productCreate: vendorProcedure.input(productCreateSchema).mutation(async ({ ctx, input }) => {
    const vendor = await requireVendor(ctx.prisma, ctx.user.id);
    assertApproved(vendor.status);
    assertImagesStorable(input.images);
    const slug = `${slugify(input.title)}-${Math.random().toString(36).slice(2, 7)}`;
    const product = await ctx.prisma.product.create({
      data: {
        vendorId: vendor.id,
        categoryId: input.categoryId,
        title: input.title,
        titleNorm: normalizeArabic(input.title),
        slug,
        description: input.description,
        basePrice: new Prisma.Decimal(input.basePrice),
        compareAtPrice: input.compareAtPrice != null ? new Prisma.Decimal(input.compareAtPrice) : null,
        status: "DRAFT",
        images: { create: input.images.map((url, i) => ({ url, sortOrder: i })) },
        variants: {
          create: input.variants.map((v) => ({
            sku: v.sku ?? null,
            attributes: v.attributes as Prisma.InputJsonValue,
            price: new Prisma.Decimal(v.price),
            stock: v.stock,
          })),
        },
      },
    });
    return { id: product.id };
  }),

  productUpdate: vendorProcedure.input(productUpdateSchema).mutation(async ({ ctx, input }) => {
    const vendor = await requireVendor(ctx.prisma, ctx.user.id);
    const owned = await ctx.prisma.product.findFirst({ where: { id: input.id, vendorId: vendor.id } });
    if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "المنتج غير موجود" });
    assertImagesStorable(input.images);

    await ctx.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: input.id },
        data: {
          title: input.title,
          titleNorm: input.title ? normalizeArabic(input.title) : undefined,
          description: input.description,
          categoryId: input.categoryId,
          basePrice: input.basePrice !== undefined ? new Prisma.Decimal(input.basePrice) : undefined,
          compareAtPrice:
            input.compareAtPrice === undefined
              ? undefined
              : input.compareAtPrice === null
                ? null
                : new Prisma.Decimal(input.compareAtPrice),
          // أي تعديل جوهري يعيد المنتج للمراجعة
          status: owned.status === "ACTIVE" ? "PENDING_REVIEW" : owned.status,
        },
      });
      if (input.images) {
        await tx.productImage.deleteMany({ where: { productId: input.id } });
        await tx.productImage.createMany({
          data: input.images.map((url, i) => ({ productId: input.id, url, sortOrder: i })),
        });
      }
    });
    return { ok: true };
  }),

  productSubmit: vendorProcedure.input(z.object({ id: z.string().cuid() })).mutation(async ({ ctx, input }) => {
    const vendor = await requireVendor(ctx.prisma, ctx.user.id);
    const product = await ctx.prisma.product.findFirst({ where: { id: input.id, vendorId: vendor.id } });
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "المنتج غير موجود" });
    if (!["DRAFT", "REJECTED"].includes(product.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن إرسال هذا المنتج للمراجعة" });
    }
    await ctx.prisma.product.update({ where: { id: input.id }, data: { status: "PENDING_REVIEW" } });
    return { ok: true };
  }),

  productArchive: vendorProcedure.input(z.object({ id: z.string().cuid() })).mutation(async ({ ctx, input }) => {
    const vendor = await requireVendor(ctx.prisma, ctx.user.id);
    const product = await ctx.prisma.product.findFirst({ where: { id: input.id, vendorId: vendor.id } });
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "المنتج غير موجود" });
    await ctx.prisma.product.update({ where: { id: input.id }, data: { status: "ARCHIVED" } });
    return { ok: true };
  }),

  // ── المخزون / المتغيّرات ──
  variantUpdate: vendorProcedure
    .input(
      z.object({
        variantId: z.string().cuid(),
        price: z.number().int().min(250).optional(),
        stock: z.number().int().min(0).optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx.prisma, ctx.user.id);
      const variant = await ctx.prisma.productVariant.findUnique({
        where: { id: input.variantId },
        include: { product: { select: { vendorId: true } } },
      });
      if (!variant || variant.product.vendorId !== vendor.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "المتغيّر غير موجود" });
      }
      await ctx.prisma.productVariant.update({
        where: { id: input.variantId },
        data: {
          price: input.price !== undefined ? new Prisma.Decimal(input.price) : undefined,
          stock: input.stock,
          isActive: input.isActive,
        },
      });
      return { ok: true };
    }),

  // ── الطلبات ──
  orders: vendorProcedure
    .input(z.object({ status: z.string().optional(), limit: z.number().int().min(1).max(50).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx.prisma, ctx.user.id);
      const where: Prisma.OrderWhereInput = { vendorId: vendor.id };
      if (input?.status) where.status = input.status as OrderStatus;
      const orders = await ctx.prisma.order.findMany({
        where,
        orderBy: { placedAt: "desc" },
        take: input?.limit ?? 30,
        include: { _count: { select: { items: true } }, customer: { select: { name: true } } },
      });
      return orders.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        total: Number(o.total),
        placedAt: o.placedAt,
        itemCount: o._count.items,
        customerName: o.customer.name ?? "زبون",
      }));
    }),

  orderById: vendorProcedure.input(z.object({ id: z.string().cuid() })).query(async ({ ctx, input }) => {
    const vendor = await requireVendor(ctx.prisma, ctx.user.id);
    const order = await ctx.prisma.order.findFirst({
      where: { id: input.id, vendorId: vendor.id },
      include: { items: true, history: { orderBy: { createdAt: "asc" } }, returnRequest: true },
    });
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "الطلب غير موجود" });
    return {
      returnRequest: order.returnRequest
        ? {
            id: order.returnRequest.id,
            status: order.returnRequest.status,
            reason: order.returnRequest.reason,
            vendorNote: order.returnRequest.vendorNote,
            createdAt: order.returnRequest.createdAt,
          }
        : null,
      id: order.id,
      number: order.number,
      status: order.status,
      subtotal: Number(order.subtotal),
      deliveryFee: Number(order.deliveryFee),
      total: Number(order.total),
      commissionAmount: Number(order.commissionAmount),
      shipTo: order.shipTo,
      customerNote: order.customerNote,
      placedAt: order.placedAt,
      items: order.items.map((it) => ({
        id: it.id,
        title: it.titleSnapshot,
        attributes: it.attributesSnapshot,
        unitPrice: Number(it.unitPrice),
        quantity: it.quantity,
        lineTotal: Number(it.lineTotal),
      })),
      history: order.history.map((h) => ({ toStatus: h.toStatus, note: h.note, createdAt: h.createdAt })),
    };
  }),

  orderUpdateStatus: vendorProcedure.input(orderStatusUpdateSchema).mutation(async ({ ctx, input }) => {
    const vendor = await requireVendor(ctx.prisma, ctx.user.id);
    const order = await ctx.prisma.order.findFirst({
      where: { id: input.orderId, vendorId: vendor.id },
      select: { id: true },
    });
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "الطلب غير موجود" });
    return changeOrderStatus(ctx.prisma, {
      orderId: input.orderId,
      to: input.status,
      actor: "VENDOR",
      actorId: ctx.user.id,
      note: input.note,
    });
  }),

  /**
   * قرار البائع في طلب الإرجاع. القبول ينقل الطلب إلى RETURNED (مع إعادة
   * المخزون عبر آلة الحالة) — الانتقال باسم المشتري لأنه صاحب الطلب الأصلي.
   */
  reviewReturn: vendorProcedure
    .input(z.object({ id: z.string().cuid(), approve: z.boolean(), note: z.string().trim().max(300).optional() }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx.prisma, ctx.user.id);
      const rr = await ctx.prisma.returnRequest.findFirst({
        where: { id: input.id, order: { vendorId: vendor.id } },
        include: { order: { select: { id: true, number: true, customerId: true, status: true } } },
      });
      if (!rr) throw new TRPCError({ code: "NOT_FOUND", message: "طلب الإرجاع غير موجود" });
      if (rr.status !== "REQUESTED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "طلب الإرجاع محسوم مسبقاً" });
      }

      if (input.approve) {
        // قبول: الطلب يتحول إلى RETURNED (المشتري هو المبادر بالطلب)
        await changeOrderStatus(ctx.prisma, {
          orderId: rr.order.id,
          to: "RETURNED",
          actor: "CUSTOMER",
          actorId: rr.order.customerId,
          note: input.note ?? "قَبِل البائع طلب الإرجاع",
        });
      }
      const updated = await ctx.prisma.returnRequest.update({
        where: { id: rr.id },
        data: {
          status: input.approve ? "APPROVED" : "REJECTED",
          vendorNote: input.note ?? null,
          decidedAt: new Date(),
        },
      });
      // إشعار المشتري بالقرار
      await ctx.prisma.notification.create({
        data: {
          userId: rr.order.customerId,
          type: "order.return_decided",
          title: input.approve ? "قُبل طلب الإرجاع" : "رُفض طلب الإرجاع",
          body: `طلبك ${rr.order.number}: ${input.approve ? "تم قبول الإرجاع، سيتواصل معك المندوب" : `رُفض الإرجاع${input.note ? ` — ${input.note}` : ""}`}.`,
          data: { orderId: rr.order.id },
        },
      });
      return { id: updated.id, status: updated.status };
    }),

  // ── التحليلات ──
  analytics: vendorProcedure.query(async ({ ctx }) => {
    const vendor = await requireVendor(ctx.prisma, ctx.user.id);
    const since14 = new Date(Date.now() - 14 * 86_400_000);
    const [productAgg, statusGroups, soldAgg, topProducts, windowOrders, lowStockVariants] = await Promise.all([
      ctx.prisma.product.groupBy({ by: ["status"], where: { vendorId: vendor.id }, _count: true }),
      ctx.prisma.order.groupBy({ by: ["status"], where: { vendorId: vendor.id }, _count: true }),
      ctx.prisma.order.aggregate({
        where: { vendorId: vendor.id, status: { in: ["DELIVERED", "COMPLETED"] } },
        _sum: { subtotal: true, commissionAmount: true },
        _count: true,
      }),
      ctx.prisma.product.findMany({
        where: { vendorId: vendor.id, soldCount: { gt: 0 } },
        orderBy: { soldCount: "desc" },
        take: 5,
        select: { id: true, title: true, soldCount: true },
      }),
      ctx.prisma.order.findMany({
        where: { vendorId: vendor.id, placedAt: { gte: since14 }, status: { not: "CANCELLED" } },
        select: { placedAt: true, subtotal: true, status: true },
      }),
      ctx.prisma.productVariant.findMany({
        where: { product: { vendorId: vendor.id }, isActive: true, stock: { lte: 5 } },
        select: { id: true, stock: true, reservedStock: true, attributes: true, product: { select: { title: true } } },
        take: 30,
      }),
    ]);
    const grossRevenue = Number(soldAgg._sum.subtotal ?? 0);
    const commission = Number(soldAgg._sum.commissionAmount ?? 0);
    const ordersByStatus: Record<string, number> = {};
    for (const g of statusGroups) ordersByStatus[g.status] = g._count;
    const productsByStatus: Record<string, number> = {};
    for (const g of productAgg) productsByStatus[g.status] = g._count;

    // سلسلة مبيعات آخر ١٤ يوماً (لرسم بياني)
    const DAYS = 14;
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const todayStart = startOfDay(now);
    const salesSeries = Array.from({ length: DAYS }, (_, k) => {
      const d = new Date(todayStart - (DAYS - 1 - k) * 86_400_000);
      return { day: `${d.getMonth() + 1}/${d.getDate()}`, revenue: 0, orders: 0 };
    });
    for (const o of windowOrders) {
      const diff = Math.floor((todayStart - startOfDay(o.placedAt)) / 86_400_000);
      const bucket = salesSeries[DAYS - 1 - diff];
      if (bucket) {
        bucket.orders += 1;
        if (o.status === "DELIVERED" || o.status === "COMPLETED") bucket.revenue += Number(o.subtotal);
      }
    }

    // مخزون منخفض (المتاح = المخزون − المحجوز)
    const lowStock = lowStockVariants
      .map((v) => ({
        id: v.id,
        title: v.product.title,
        attributes: (v.attributes ?? {}) as Record<string, string>,
        available: v.stock - v.reservedStock,
      }))
      .filter((v) => v.available <= 5)
      .sort((a, b) => a.available - b.available)
      .slice(0, 8);

    return {
      grossRevenue,
      commission,
      netRevenue: grossRevenue - commission,
      completedOrders: soldAgg._count,
      pendingOrders: ordersByStatus["PENDING"] ?? 0,
      ordersByStatus,
      productsByStatus,
      topProducts,
      salesSeries,
      lowStock,
    };
  }),

  // ── الرصيد والتسويات ──
  payouts: vendorProcedure.query(async ({ ctx }) => {
    const vendor = await requireVendor(ctx.prisma, ctx.user.id);
    // الرصيد المستحق = صافي الطلبات المسلّمة/المكتملة ذات العمولة غير المسوّاة
    const unsettled = await ctx.prisma.commission.findMany({
      where: {
        vendorId: vendor.id,
        payoutId: null,
        order: { status: { in: ["DELIVERED", "COMPLETED"] } },
      },
      include: { order: { select: { subtotal: true } } },
    });
    const pendingBalance = unsettled.reduce(
      (s, c) => s + (Number(c.order.subtotal) - Number(c.amount)),
      0,
    );
    const payouts = await ctx.prisma.payout.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: "desc" },
    });
    return {
      pendingBalance,
      payouts: payouts.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        paidAt: p.paidAt,
      })),
    };
  }),

  // ── كشف الحساب المالي (بفلتر زمني) ──
  financeSummary: vendorProcedure
    .input(z.object({ period: z.enum(["today", "7d", "30d", "all"]).default("30d") }))
    .query(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx.prisma, ctx.user.id);
      const since = periodSince(input.period);

      const [realized, pendingAgg, unsettled] = await Promise.all([
        // المُنجز (مسلّم/مكتمل) ضمن الفترة — الإيراد المعترف به
        ctx.prisma.order.aggregate({
          where: {
            vendorId: vendor.id,
            status: { in: ["DELIVERED", "COMPLETED"] },
            ...(since ? { placedAt: { gte: since } } : {}),
          },
          _sum: { subtotal: true, commissionAmount: true },
          _count: true,
        }),
        // قيد التنفيذ (لم يُنجز بعد) ضمن الفترة — للسياق
        ctx.prisma.order.aggregate({
          where: {
            vendorId: vendor.id,
            status: { in: ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED"] },
            ...(since ? { placedAt: { gte: since } } : {}),
          },
          _sum: { subtotal: true },
          _count: true,
        }),
        // الرصيد المستحق (كل الفترات، غير مسوّى) — رصيد لحظي
        ctx.prisma.commission.findMany({
          where: { vendorId: vendor.id, payoutId: null, order: { status: { in: ["DELIVERED", "COMPLETED"] } } },
          include: { order: { select: { subtotal: true } } },
        }),
      ]);

      const grossSales = Number(realized._sum.subtotal ?? 0);
      const commission = Number(realized._sum.commissionAmount ?? 0);
      const netEarnings = grossSales - commission;
      const realizedOrders = realized._count;
      const outstandingBalance = unsettled.reduce((s, c) => s + (Number(c.order.subtotal) - Number(c.amount)), 0);

      return {
        period: input.period,
        grossSales,
        commission,
        netEarnings,
        realizedOrders,
        avgOrderValue: realizedOrders > 0 ? grossSales / realizedOrders : 0,
        pendingSales: Number(pendingAgg._sum.subtotal ?? 0),
        pendingOrders: pendingAgg._count,
        outstandingBalance,
      };
    }),

  /** تصدير كشف حساب البائع (طلبات الفترة مع تفصيل الأرباح) كـ CSV بترميز يدعم العربية. */
  exportStatementCsv: vendorProcedure
    .input(z.object({ period: z.enum(["today", "7d", "30d", "all"]).default("30d") }))
    .query(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx.prisma, ctx.user.id);
      const since = periodSince(input.period);
      const orders = await ctx.prisma.order.findMany({
        where: { vendorId: vendor.id, ...(since ? { placedAt: { gte: since } } : {}) },
        orderBy: { placedAt: "desc" },
        take: 5000,
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
      const headers = ["رقم الطلب", "التاريخ", "الحالة", "قيمة البضاعة", "نسبة العمولة", "العمولة", "صافي الربح"];
      const rows = orders.map((o) => {
        const realized = o.status === "DELIVERED" || o.status === "COMPLETED";
        const commission = Number(o.commissionAmount);
        const net = realized ? Number(o.subtotal) - commission : 0;
        return [
          o.number,
          o.placedAt.toISOString().slice(0, 16).replace("T", " "),
          STATUS_AR[o.status] ?? o.status,
          Number(o.subtotal),
          `${(Number(o.commissionRate) * 100).toFixed(2)}%`,
          realized ? commission : 0,
          net,
        ]
          .map(esc)
          .join(",");
      });
      const csv = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      return { filename: `statement-${input.period}-${new Date().toISOString().slice(0, 10)}.csv`, csv, count: orders.length };
    }),
});

/** بداية الفترة الزمنية للفلاتر المالية (null = كل الوقت). */
function periodSince(period: "today" | "7d" | "30d" | "all"): Date | null {
  const now = new Date();
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "7d") return new Date(now.getTime() - 7 * 86_400_000);
  if (period === "30d") return new Date(now.getTime() - 30 * 86_400_000);
  return null;
}
