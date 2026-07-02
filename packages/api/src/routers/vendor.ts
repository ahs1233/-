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
      include: { items: true, history: { orderBy: { createdAt: "asc" } } },
    });
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "الطلب غير موجود" });
    return {
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

  // ── التحليلات ──
  analytics: vendorProcedure.query(async ({ ctx }) => {
    const vendor = await requireVendor(ctx.prisma, ctx.user.id);
    const [productAgg, statusGroups, soldAgg, topProducts] = await Promise.all([
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
    ]);
    const grossRevenue = Number(soldAgg._sum.subtotal ?? 0);
    const commission = Number(soldAgg._sum.commissionAmount ?? 0);
    const ordersByStatus: Record<string, number> = {};
    for (const g of statusGroups) ordersByStatus[g.status] = g._count;
    const productsByStatus: Record<string, number> = {};
    for (const g of productAgg) productsByStatus[g.status] = g._count;
    return {
      grossRevenue,
      commission,
      netRevenue: grossRevenue - commission,
      completedOrders: soldAgg._count,
      pendingOrders: ordersByStatus["PENDING"] ?? 0,
      ordersByStatus,
      productsByStatus,
      topProducts,
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
});
