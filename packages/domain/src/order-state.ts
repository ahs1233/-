/**
 * آلة حالة الطلب — منطق نقي بلا اعتماد على قاعدة البيانات.
 * المسار الطبيعي:
 *   pending → confirmed → preparing → shipped → delivered → completed
 * مع مخارج: cancelled / returned.
 *
 * صلاحية كل انتقال مقيّدة بالدور (من يحق له تنفيذه).
 */

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "RETURNED";

export type Actor = "CUSTOMER" | "VENDOR" | "ADMIN" | "SYSTEM";

interface Transition {
  to: OrderStatus;
  /** الأدوار المسموح لها بتنفيذ هذا الانتقال. */
  by: Actor[];
}

/**
 * خريطة الانتقالات المسموحة من كل حالة.
 * الأدمن مسموح له بكل انتقال (override) ويُضاف ضمنياً.
 */
const TRANSITIONS: Record<OrderStatus, Transition[]> = {
  PENDING: [
    { to: "CONFIRMED", by: ["VENDOR"] },
    { to: "CANCELLED", by: ["CUSTOMER", "VENDOR"] },
  ],
  CONFIRMED: [
    { to: "PREPARING", by: ["VENDOR"] },
    { to: "CANCELLED", by: ["VENDOR"] }, // قبل التحضير فقط
  ],
  PREPARING: [
    { to: "SHIPPED", by: ["VENDOR"] },
    { to: "CANCELLED", by: ["VENDOR"] },
  ],
  SHIPPED: [
    { to: "DELIVERED", by: ["VENDOR", "SYSTEM"] },
    { to: "RETURNED", by: ["CUSTOMER", "VENDOR"] },
  ],
  DELIVERED: [
    { to: "COMPLETED", by: ["CUSTOMER", "SYSTEM"] }, // تأكيد الاستلام أو إغلاق تلقائي
    { to: "RETURNED", by: ["CUSTOMER"] },
  ],
  COMPLETED: [], // حالة نهائية
  CANCELLED: [], // حالة نهائية
  RETURNED: [], // حالة نهائية
};

/** الحالات النهائية التي لا انتقال منها. */
export const TERMINAL_STATUSES: OrderStatus[] = ["COMPLETED", "CANCELLED", "RETURNED"];

/** الحالات التي يجب فيها أن يبقى المخزون محجوزاً/مخصوماً. */
export const STOCK_HELD_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
];

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from].map((t) => t.to);
}

export interface TransitionCheck {
  ok: boolean;
  reason?: string;
}

/**
 * يتحقق من صلاحية انتقال حالة بواسطة دور معيّن.
 * الأدمن يتجاوز قيود الدور لكنه يبقى مقيّداً بصحة الانتقال نفسه
 * (لا يقفز إلى حالة غير مسموحة من الحالة الحالية).
 */
export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: Actor,
): TransitionCheck {
  if (from === to) return { ok: false, reason: "لا تغيير في الحالة" };
  if (isTerminal(from)) {
    return { ok: false, reason: `الطلب في حالة نهائية (${from})` };
  }
  const transition = TRANSITIONS[from].find((t) => t.to === to);
  if (!transition) {
    return { ok: false, reason: `انتقال غير مسموح: ${from} → ${to}` };
  }
  if (actor !== "ADMIN" && !transition.by.includes(actor)) {
    return { ok: false, reason: `الدور ${actor} لا يملك صلاحية هذا الانتقال` };
  }
  return { ok: true };
}

/** يصرّح الانتقال أو يرمي خطأً — للاستخدام في طبقة الخدمة. */
export function assertTransition(from: OrderStatus, to: OrderStatus, actor: Actor): void {
  const res = canTransition(from, to, actor);
  if (!res.ok) {
    throw new OrderTransitionError(res.reason ?? "انتقال غير مسموح");
  }
}

export class OrderTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderTransitionError";
  }
}
