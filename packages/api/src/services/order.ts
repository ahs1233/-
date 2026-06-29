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
  calculateCommission,
  resolveCommissionRate,
  buildOrderNumber,
  reservationExpiry,
  canTransition,
  type Actor,
} from "@al-souq/domain";
import { sendPush, sendPushMany, type PushPayload } from "./push";

const DELIVERY_FEE_IQD = 5000; // رسوم توصيل ثابتة مبدئياً (ستُحسب لاحقاً حسب المحافظة)
const PLATFORM_RATE_FALLBACK = 0.1;

type Tx = Prisma.TransactionClient;

export interface PlaceOrderInput {
  customerId: string;
  addressId: string;
  items: { productId: string; variantId: string | null; quantity: number }[];
  customerNote?: string;
}

async function getPlatformRate(db: Tx | PrismaClient): Promise<number> {
  const setting = await db.platformSetting.findUnique({ where: { key: "commission_rate" } });
  const val = setting?.value;
  return typeof val === "number" ? val : PLATFORM_RATE_FALLBACK;
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
    const platformRate = await getPlatformRate(tx);

    // حلّ المتغيّرات والتحقق من توفّرها وحالة المنتج/البائع
    interface Resolved {
      variantId: string;
      productId: string;
      vendorId: string;
      vendorRate: number | null;
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

    const baseCount = await tx.order.count();
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

    for (const [vendorId, items] of byVendor) {
      const subtotal = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
      const rate = resolveCommissionRate(platformRate, items[0]!.vendorRate);
      const { commissionAmount } = calculateCommission(subtotal, rate);
      const total = subtotal + DELIVERY_FEE_IQD;

      const order = await tx.order.create({
        data: {
          number: buildOrderNumber(baseCount + 1 + idx),
          customerId: input.customerId,
          vendorId,
          status: "PENDING",
          subtotal: new Prisma.Decimal(subtotal),
          deliveryFee: new Prisma.Decimal(DELIVERY_FEE_IQD),
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
      include: { product: { include: { vendor: true } } },
    });
    if (!variant || variant.productId !== productId || !variant.isActive) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "خيار المنتج غير صالح" });
    }
    return variant;
  }
  // بلا متغيّر محدّد: يُقبل فقط إن كان للمنتج متغيّر واحد فعّال
  const variants = await tx.productVariant.findMany({
    where: { productId, isActive: true },
    include: { product: { include: { vendor: true } } },
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
