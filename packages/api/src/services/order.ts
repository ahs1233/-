/**
 * خدمة الطلبات — منطق الأعمال الحرج لتطبيق المشتري.
 *
 * COD: لا يُحجز مبلغ، لكن يُحجز المخزون فور إنشاء الطلب (reservedStock) مع
 * انتهاء صلاحية. منع التزامن (race conditions) يتم عبر تحديث SQL شرطي ذرّي:
 *   UPDATE ... SET reservedStock = reservedStock + q WHERE stock - reservedStock >= q
 * فإن لم يتأثر صف → المخزون غير كافٍ (بأمان حتى تحت الضغط المتزامن).
 *
 * دورة حياة المخزون:
 *   PENDING..SHIPPED  → محجوز (reservedStock مرفوع، stock كما هو)
 *   DELIVERED         → بيع نهائي: stock--، reservedStock--، soldCount++
 *   CANCELLED (قبل الشحن) → تحرير: reservedStock--
 *   RETURNED          → تحرير الحجز، وإن كان قد سُلِّم تُعاد الكمية للمخزون
 */
import { TRPCError } from "@trpc/server";
import { Prisma, type PrismaClient, type OrderStatus } from "@al-souq/db";
import {
  resolveItemCommissionRate,
  buildOrderNumber,
  orderNumberPrefix,
  parseOrderSequence,
  reservationExpiry,
  canTransition,
  type Actor,
} from "@al-souq/domain";
import { sendPush, sendPushMany, type PushPayload } from "./push";
import { resolveCoupon, computeDiscount } from "./coupon";

const DELIVERY_FEE_FALLBACK_IQD = 5000;
const PLATFORM_RATE_FALLBACK = 0.1;

type Tx = Prisma.TransactionClient;

export interface PlaceOrderInput {
  customerId: string;
  addressId: string;
  items: { productId: string; variantId: string | null; quantity: number }[];
  customerNote?: string;
  couponCode?: string;
}

async function getPlatformRate(db: Tx | PrismaClient): Promise<number> {
  const setting = await db.platformSetting.findUnique({ where: { key: "commission_rate" } });
  const val = setting?.value;
  return typeof val === "number" ? val : PLATFORM_RATE_FALLBACK;
}

/** الحدّ الأدنى لقيمة السلة (بضاعة) لإتمام الطلب. 0 = بلا حدّ. */
async function getMinOrderValue(db: Tx | PrismaClient): Promise<number> {
  const setting = await db.platformSetting.findUnique({ where: { key: "min_order_value" } });
  return typeof setting?.value === "number" ? setting.value : 0;
}

/**
 * رسوم التوصيل الفعلية لمحافظة العنوان: رسوم خاصة بالمحافظة إن ضُبطت،
 * وإلا الرسوم الافتراضية من إعدادات المنصة، وإلا القيمة الاحتياطية.
 */
export async function getDeliveryFee(db: Tx | PrismaClient, governorateId?: string): Promise<number> {
  const [byGovSetting, defaultSetting] = await Promise.all([
    governorateId ? db.platformSetting.findUnique({ where: { key: "delivery_fees_by_gov" } }) : null,
    db.platformSetting.findUnique({ where: { key: "delivery_fee" } }),
  ]);
  if (governorateId && byGovSetting?.value && typeof byGovSetting.value === "object") {
    const fee = (byGovSetting.value as Record<string, unknown>)[governorateId];
    if (typeof fee === "number") return fee;
  }
  return typeof defaultSetting?.value === "number" ? defaultSetting.value : DELIVERY_FEE_FALLBACK_IQD;
}

/**
 * ينشئ الطلب/الطلبات (طلب لكل بائع) ضمن معاملة واحدة مع حجز مخزون ذرّي.
 * يُعيد ملخّص الطلبات المُنشأة.
 */
export async function placeOrder(prisma: PrismaClient, input: PlaceOrderInput) {
  // التحقق من ملكية العنوان (حماية IDOR)
  const address = await prisma.address.findUnique({
    where: { id: input.addressId },
    include: { governorate: true, area: true },
  });
  if (!address || address.userId !== input.customerId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "عنوان غير صالح" });
  }

  // مهام Push تُجمع داخل المعاملة وتُرسل بعد نجاحها (لا شبكة داخل المعاملة)
  const pushJobs: { userId: string; payload: PushPayload }[] = [];

  const result = await prisma.$transaction(async (tx) => {
    const [platformRate, deliveryFee] = await Promise.all([
      getPlatformRate(tx),
      getDeliveryFee(tx, address.governorateId),
    ]);

    // حلّ المتغيّرات والتحقق من توفّرها وحالة المنتج/البائع
    interface Resolved {
      variantId: string;
      productId: string;
      vendorId: string;
      vendorRate: number | null;
      categoryRate: number | null;
      title: string;
      attributes: Prisma.JsonValue;
      unitPrice: number;
      quantity: number;
    }
    const resolved: Resolved[] = [];

    for (const item of input.items) {
      const variant = await resolveVariant(tx, item.productId, item.variantId);
      if (variant.product.status !== "ACTIVE" || variant.product.vendor.status !== "APPROVED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `منتج غير متاح: ${variant.product.title}` });
      }
      resolved.push({
        variantId: variant.id,
        productId: variant.productId,
        vendorId: variant.product.vendorId,
        vendorRate: variant.product.vendor.commissionRate ? Number(variant.product.vendor.commissionRate) : null,
        categoryRate: variant.product.category?.commissionRate ? Number(variant.product.category.commissionRate) : null,
        title: variant.product.title,
        attributes: variant.attributes,
        unitPrice: Number(variant.price),
        quantity: item.quantity,
      });
    }

    // الحجز الذرّي لكل عنصر
    for (const r of resolved) {
      const affected = await tx.$executeRaw`
        UPDATE "ProductVariant"
        SET "reservedStock" = "reservedStock" + ${r.quantity}
        WHERE "id" = ${r.variantId} AND "stock" - "reservedStock" >= ${r.quantity}`;
      if (affected === 0) {
        throw new TRPCError({ code: "CONFLICT", message: `الكمية المطلوبة غير متوفرة: ${r.title}` });
      }
    }

    // التجميع حسب البائع
    const byVendor = new Map<string, Resolved[]>();
    for (const r of resolved) {
      const arr = byVendor.get(r.vendorId) ?? [];
      arr.push(r);
      byVendor.set(r.vendorId, arr);
    }

    // مجموع كل بائع (بترتيب ثابت) — يُستخدم للتوزيع النسبي للخصم.
    const vendorEntries = [...byVendor.entries()].map(([vendorId, items]) => ({
      vendorId,
      items,
      subtotal: items.reduce((s, it) => s + it.unitPrice * it.quantity, 0),
    }));
    const cartSubtotal = vendorEntries.reduce((s, v) => s + v.subtotal, 0);

    // الحدّ الأدنى لقيمة الطلب (سياسة المنصّة)
    const minOrder = await getMinOrderValue(tx);
    if (minOrder > 0 && cartSubtotal < minOrder) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `الحدّ الأدنى للطلب ${minOrder.toLocaleString("en-US")} د.ع`,
      });
    }

    // ── الكوبون: يُحسب على مجموع السلة كاملاً ثم يُوزَّع بالتناسب على البائعين ──
    let couponId: string | null = null;
    let couponCodeSnap: string | null = null;
    const discountByVendor = new Map<string, number>();
    if (input.couponCode) {
      const coupon = await resolveCoupon(tx, input.couponCode);
      const totalDiscount = computeDiscount(coupon, cartSubtotal);
      // حجز استخدام ذرّي: يفشل إن بلغ الحدّ (يمنع تجاوزه تحت التزامن).
      const bumped = await tx.coupon.updateMany({
        where: {
          id: coupon.id,
          isActive: true,
          ...(coupon.usageLimit !== null ? { usedCount: { lt: coupon.usageLimit } } : {}),
        },
        data: { usedCount: { increment: 1 } },
      });
      if (bumped.count === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "بلغ الكوبون حدّ الاستخدام" });
      }
      couponId = coupon.id;
      couponCodeSnap = coupon.code;
      // توزيع نسبي مع تصحيح الباقي في آخر بائع (يضمن مساواة المجموع تماماً).
      let allocated = 0;
      vendorEntries.forEach((v, i) => {
        const share =
          i === vendorEntries.length - 1
            ? totalDiscount - allocated
            : cartSubtotal > 0
              ? Math.round((totalDiscount * v.subtotal) / cartSubtotal)
              : 0;
        discountByVendor.set(v.vendorId, share);
        allocated += share;
      });
    }
    void couponId;

    // تسلسلُ رقم الطلب مشتقٌّ من أعلى رقمٍ قائمٍ لشهر الحال — مُقاومٌ للحذف
    // (العدّ الكلّي كان قد يُعيد توليد رقمٍ محذوفٍ فيتضارب مع القيد الفريد).
    const prefix = orderNumberPrefix();
    const lastForMonth = await tx.order.findFirst({
      where: { number: { startsWith: prefix } },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const baseSeq = lastForMonth ? parseOrderSequence(lastForMonth.number) : 0;
    const expiresAt = reservationExpiry();
    const shipTo = {
      fullName: address.fullName,
      phone: address.phone,
      governorate: address.governorate.nameAr,
      area: address.area.nameAr,
      line: address.line,
    };

    const created: { id: string; number: string; vendorId: string; total: number }[] = [];
    let idx = 0;

    for (const { vendorId, items, subtotal } of vendorEntries) {
      // العمولة موزونة لكل عنصر (فئة ← بائع ← منصّة)، على المجموع الكامل
      // (المنصّة تتحمّل الخصم). النسبة المخزّنة هي المعدّل الفعلي الموزون.
      let commissionAmount = 0;
      for (const it of items) {
        const itemRate = resolveItemCommissionRate(platformRate, it.vendorRate, it.categoryRate);
        commissionAmount += Math.round(it.unitPrice * it.quantity * itemRate);
      }
      const rate = subtotal > 0 ? commissionAmount / subtotal : platformRate;
      const discount = discountByVendor.get(vendorId) ?? 0;
      const total = subtotal - discount + deliveryFee;

      const order = await tx.order.create({
        data: {
          number: buildOrderNumber(baseSeq + 1 + idx),
          customerId: input.customerId,
          vendorId,
          status: "PENDING",
          subtotal: new Prisma.Decimal(subtotal),
          deliveryFee: new Prisma.Decimal(deliveryFee),
          discount: new Prisma.Decimal(discount),
          couponCode: couponCodeSnap,
          total: new Prisma.Decimal(total),
          commissionRate: new Prisma.Decimal(rate),
          commissionAmount: new Prisma.Decimal(commissionAmount),
          shipTo,
          customerNote: input.customerNote,
          items: {
            create: items.map((it) => ({
              productId: it.productId,
              variantId: it.variantId,
              titleSnapshot: it.title,
              attributesSnapshot: (it.attributes ?? {}) as Prisma.InputJsonValue,
              unitPrice: new Prisma.Decimal(it.unitPrice),
              quantity: it.quantity,
              lineTotal: new Prisma.Decimal(it.unitPrice * it.quantity),
            })),
          },
          history: { create: { fromStatus: null, toStatus: "PENDING", changedById: input.customerId } },
          commission: {
            create: { vendorId, rate: new Prisma.Decimal(rate), amount: new Prisma.Decimal(commissionAmount) },
          },
        },
      });

      // سجلّات حجز المخزون (للتعقّب وانتهاء الصلاحية)
      for (const it of items) {
        await tx.stockReservation.create({
          data: { variantId: it.variantId, orderId: order.id, quantity: it.quantity, expiresAt },
        });
      }

      // إشعارات
      await tx.notification.create({
        data: {
          userId: input.customerId,
          type: "order.placed",
          title: "تم استلام طلبك",
          body: `طلبك رقم ${order.number} بانتظار تأكيد البائع.`,
          data: { orderId: order.id },
        },
      });
      pushJobs.push({
        userId: input.customerId,
        payload: { title: "تم استلام طلبك", body: `طلبك ${order.number} بانتظار التأكيد.`, url: `/orders/${order.id}` },
      });
      const vendorUser = await tx.vendorProfile.findUnique({ where: { id: vendorId }, select: { userId: true } });
      if (vendorUser) {
        await tx.notification.create({
          data: {
            userId: vendorUser.userId,
            type: "order.new",
            title: "طلب جديد",
            body: `لديك طلب جديد رقم ${order.number}.`,
            data: { orderId: order.id },
          },
        });
        pushJobs.push({
          userId: vendorUser.userId,
          payload: { title: "طلب جديد", body: `طلب ${order.number}`, url: `/vendor/orders/${order.id}` },
        });
      }

      created.push({ id: order.id, number: order.number, vendorId, total });
      idx++;
    }

    return { orders: created };
  });

  // إرسال Push بعد نجاح المعاملة (best-effort)
  await sendPushMany(prisma, pushJobs).catch(() => undefined);
  return result;
}

async function resolveVariant(tx: Tx, productId: string, variantId: string | null) {
  if (variantId) {
    const variant = await tx.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { include: { vendor: true, category: { select: { commissionRate: true } } } } },
    });
    if (!variant || variant.productId !== productId || !variant.isActive) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "خيار المنتج غير صالح" });
    }
    return variant;
  }
  // بلا متغيّر محدّد: يُقبل فقط إن كان للمنتج متغيّر واحد فعّال
  const variants = await tx.productVariant.findMany({
    where: { productId, isActive: true },
    include: { product: { include: { vendor: true, category: { select: { commissionRate: true } } } } },
  });
  if (variants.length !== 1) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "يجب اختيار أحد خيارات المنتج" });
  }
  return variants[0]!;
}

/**
 * يغيّر حالة الطلب مع تطبيق آثار المخزون والإشعارات وسجل الحالات، ضمن معاملة.
 * يُستخدم لإلغاء المشتري وتأكيد الاستلام الآن، ولوحة البائع لاحقاً.
 */
export async function changeOrderStatus(
  prisma: PrismaClient,
  args: { orderId: string; to: OrderStatus; actor: Actor; actorId: string; note?: string },
) {
  const { order: updated, push } = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: args.orderId },
      include: { items: true, vendor: { select: { userId: true } } },
    });
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "الطلب غير موجود" });

    const check = canTransition(order.status, args.to, args.actor);
    if (!check.ok) throw new TRPCError({ code: "BAD_REQUEST", message: check.reason });

    await applyStockEffects(tx, order.id, order.status, args.to, order.items);

    const result = await tx.order.update({
      where: { id: order.id },
      data: {
        status: args.to,
        ...(args.to === "CANCELLED" ? { cancelReason: args.note } : {}),
        history: { create: { fromStatus: order.status, toStatus: args.to, changedById: args.actorId, note: args.note } },
      },
    });

    // إشعار المشتري بتغيّر الحالة
    await tx.notification.create({
      data: {
        userId: order.customerId,
        type: "order.status_changed",
        title: "تحديث حالة الطلب",
        body: `طلبك ${order.number}: ${statusLabel(args.to)}.`,
        data: { orderId: order.id, status: args.to },
      },
    });

    const push: { userId: string; payload: PushPayload } = {
      userId: order.customerId,
      payload: { title: "تحديث حالة الطلب", body: `${order.number}: ${statusLabel(args.to)}`, url: `/orders/${order.id}` },
    };
    return { order: result, push };
  });

  await sendPush(prisma, push.userId, push.payload).catch(() => undefined);
  return updated;
}

async function applyStockEffects(
  tx: Tx,
  orderId: string,
  from: OrderStatus,
  to: OrderStatus,
  items: { variantId: string | null; productId: string; quantity: number }[],
) {
  const variantItems = items.filter((i) => i.variantId);

  if (to === "DELIVERED") {
    // بيع نهائي: خصم من المخزون وتحرير الحجز
    for (const it of variantItems) {
      await tx.productVariant.update({
        where: { id: it.variantId! },
        data: { stock: { decrement: it.quantity }, reservedStock: { decrement: it.quantity } },
      });
      await tx.product.update({ where: { id: it.productId }, data: { soldCount: { increment: it.quantity } } });
    }
    await tx.stockReservation.updateMany({ where: { orderId }, data: { status: "CONSUMED" } });
  } else if (to === "CANCELLED") {
    // قبل الشحن: المخزون ما زال محجوزاً → تحرير
    for (const it of variantItems) {
      await tx.productVariant.update({ where: { id: it.variantId! }, data: { reservedStock: { decrement: it.quantity } } });
    }
    await tx.stockReservation.updateMany({ where: { orderId }, data: { status: "RELEASED" } });
  } else if (to === "RETURNED") {
    if (from === "DELIVERED") {
      // كان قد خُصم من المخزون → إعادته
      for (const it of variantItems) {
        await tx.productVariant.update({ where: { id: it.variantId! }, data: { stock: { increment: it.quantity } } });
        await tx.product.update({ where: { id: it.productId }, data: { soldCount: { decrement: it.quantity } } });
      }
    } else {
      // ما زال محجوزاً (SHIPPED) → تحرير الحجز
      for (const it of variantItems) {
        await tx.productVariant.update({ where: { id: it.variantId! }, data: { reservedStock: { decrement: it.quantity } } });
      }
    }
    await tx.stockReservation.updateMany({ where: { orderId }, data: { status: "RELEASED" } });
  }
  // COMPLETED / CONFIRMED / PREPARING / SHIPPED: لا تغيير على المخزون (يبقى محجوزاً)
}

function statusLabel(s: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    PENDING: "بانتظار التأكيد",
    CONFIRMED: "تم التأكيد",
    PREPARING: "قيد التحضير",
    SHIPPED: "تم الشحن",
    DELIVERED: "تم التوصيل",
    COMPLETED: "مكتمل",
    CANCELLED: "ملغى",
    RETURNED: "مُرتجع",
  };
  return map[s];
}

/**
 * يحرّر حجوزات المخزون منتهية الصلاحية لطلبات ما زالت PENDING، ويلغي تلك الطلبات.
 * يُستدعى انتهازياً عند إنشاء/جلب الطلبات (وبشكل دوري لاحقاً عبر مهمة مجدولة).
 */
export async function releaseExpiredReservations(prisma: PrismaClient): Promise<number> {
  const now = new Date();
  const expired = await prisma.stockReservation.findMany({
    where: { status: "ACTIVE", expiresAt: { lte: now }, order: { status: "PENDING" } },
    select: { orderId: true },
    distinct: ["orderId"],
  });
  let released = 0;
  for (const e of expired) {
    if (!e.orderId) continue;
    await changeOrderStatus(prisma, {
      orderId: e.orderId,
      to: "CANCELLED",
      actor: "SYSTEM",
      actorId: "system",
      note: "انتهت مهلة حجز المخزون دون تأكيد",
    }).catch(() => undefined);
    released++;
  }
  return released;
}
