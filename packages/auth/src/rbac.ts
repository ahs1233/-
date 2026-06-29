/**
 * RBAC — أدوات تحكّم بالوصول حسب الدور.
 * تُستخدم في طبقة tRPC لحماية كل endpoint، وفي الواجهة لإخفاء العناصر.
 */
import type { AppRole } from "./jwt";

export const ROLES: AppRole[] = ["CUSTOMER", "VENDOR", "ADMIN"];

/** هل يملك الدور الصلاحية المطلوبة (مع اعتبار الأدمن أعلى صلاحية)؟ */
export function hasRole(role: AppRole, required: AppRole | AppRole[]): boolean {
  if (role === "ADMIN") return true; // الأدمن يصل لكل شيء
  const allowed = Array.isArray(required) ? required : [required];
  return allowed.includes(role);
}

export class ForbiddenError extends Error {
  constructor(message = "غير مصرّح لك بهذا الإجراء") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertRole(role: AppRole, required: AppRole | AppRole[]): void {
  if (!hasRole(role, required)) throw new ForbiddenError();
}
