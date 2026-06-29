/**
 * خدمات الأدمن: سجل التدقيق وتسوية مستحقات البائع.
 */
import { Prisma, type PrismaClient } from "@al-souq/db";

export interface AuditInput {
  actorId: string;
  action: string; // مثل vendor.approve | product.reject | payout.create
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}

/** يكتب قيداً في سجل التدقيق (يُستدعى ضمن معاملة أو مباشرةً). */
export async function writeAudit(
  db: PrismaClient | Prisma.TransactionClient,
  input: AuditInput,
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: (input.before ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      after: (input.after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      ip: input.ip,
    },
  });
}

export interface SettleResult {
  payoutId: string;
  amount: number;
  commissionsCount: number;
}

/**
 * يسوّي مستحقات بائع: يجمع العمولات غير المسوّاة لطلبات مسلّمة/مكتملة،
 * ينشئ Payout مدفوعاً يساوي صافي البائع، ويربط العمولات به. ذرّي عبر معاملة.
 */
export async function settleVendorPayout(
  prisma: PrismaClient,
  args: { vendorId: string; adminId: string; ip?: string },
): Promise<SettleResult | null> {
  return prisma.$transaction(async (tx) => {
    const commissions = await tx.commission.findMany({
      where: {
        vendorId: args.vendorId,
        payoutId: null,
        order: { status: { in: ["DELIVERED", "COMPLETED"] } },
      },
      include: { order: { select: { subtotal: true, placedAt: true } } },
    });
    if (commissions.length === 0) return null;

    const net = commissions.reduce((s, c) => s + (Number(c.order.subtotal) - Number(c.amount)), 0);
    const dates = commissions.map((c) => c.order.placedAt.getTime());
    const periodStart = new Date(Math.min(...dates));
    const periodEnd = new Date(Math.max(...dates));

    const payout = await tx.payout.create({
      data: {
        vendorId: args.vendorId,
        amount: new Prisma.Decimal(net),
        status: "PAID",
        periodStart,
        periodEnd,
        paidAt: new Date(),
      },
    });

    await tx.commission.updateMany({
      where: { id: { in: commissions.map((c) => c.id) } },
      data: { payoutId: payout.id },
    });

    const vendor = await tx.vendorProfile.findUnique({ where: { id: args.vendorId }, select: { userId: true } });
    if (vendor) {
      await tx.notification.create({
        data: {
          userId: vendor.userId,
          type: "payout.paid",
          title: "تمت تسوية مستحقاتك",
          body: `تم تحويل ${net.toLocaleString("ar-IQ")} د.ع لحسابك.`,
          data: { payoutId: payout.id },
        },
      });
    }

    await writeAudit(tx, {
      actorId: args.adminId,
      action: "payout.create",
      entityType: "Payout",
      entityId: payout.id,
      after: { vendorId: args.vendorId, amount: net, commissions: commissions.length },
      ip: args.ip,
    });

    return { payoutId: payout.id, amount: net, commissionsCount: commissions.length };
  });
}
