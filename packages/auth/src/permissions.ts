/**
 * صلاحيات الموظفين الإداريين (Admin staff RBAC).
 *
 * كل مستخدم بدور ADMIN قد يكون:
 *  - «مدير عام» (permissions === null) → كل الصلاحيات (توافق مع الأدمن الأصلي).
 *  - «موظف» بمصفوفة صلاحيات محدّدة تناسب وظيفته.
 *
 * نُبقي الصلاحيات على مستوى الأقسام (لا CRUD دقيق) لتبقى الواجهة والتحقّق بسيطين.
 */
import type { AppRole } from "./jwt";

export const ADMIN_PERMISSIONS = [
  "dashboard", // المؤشرات
  "orders", // الطلبات (عرض/إدارة) — يشمل مركز الاتصال
  "finance", // المالية والتسويات والتقارير
  "vendors", // المتاجر (اعتماد/إدارة/عمولة)
  "products", // مراجعة المنتجات والفئات المرتبطة
  "categories", // إدارة الفئات
  "coupons", // الكوبونات والتسويق
  "users", // المستخدمون
  "settings", // إعدادات المنصّة
  "audit", // سجل التدقيق
  "staff", // إدارة حسابات الموظفين (المدير العام)
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

/** قوالب أدوار جاهزة تُبسّط إنشاء الحسابات. */
export const STAFF_PRESETS: Record<
  string,
  { label: string; permissions: AdminPermission[]; scoped?: boolean }
> = {
  SUPER: { label: "مدير عام", permissions: [...ADMIN_PERMISSIONS] },
  GOVERNORATE: { label: "مدير محافظة", permissions: ["dashboard", "orders", "vendors"], scoped: true },
  ACCOUNTS: { label: "مدير الحسابات", permissions: ["dashboard", "finance"] },
  MARKETING: { label: "مدير التسويق", permissions: ["dashboard", "coupons", "products"] },
  PRODUCTS: { label: "مدير المنتجات", permissions: ["dashboard", "products", "categories"] },
  CALLCENTER: { label: "مدير مركز الاتصال", permissions: ["dashboard", "orders"] },
};

export type StaffPreset = keyof typeof STAFF_PRESETS;

/** الصلاحيات الفعلية لمستخدم: مدير عام (null) → الكل؛ غير الأدمن → لا شيء. */
export function effectivePermissions(role: AppRole, permissions: unknown): AdminPermission[] {
  if (role !== "ADMIN") return [];
  if (permissions === null || permissions === undefined) return [...ADMIN_PERMISSIONS];
  if (Array.isArray(permissions)) {
    return permissions.filter((p): p is AdminPermission =>
      (ADMIN_PERMISSIONS as readonly string[]).includes(p as string),
    );
  }
  return [];
}

/** هل يملك المستخدم صلاحية قسم معيّن؟ */
export function hasPermission(role: AppRole, permissions: unknown, perm: AdminPermission): boolean {
  if (role !== "ADMIN") return false;
  if (permissions === null || permissions === undefined) return true; // مدير عام
  return effectivePermissions(role, permissions).includes(perm);
}

/** المدير العام = من يملك صلاحية إدارة الموظفين. */
export function isSuperAdmin(role: AppRole, permissions: unknown): boolean {
  return hasPermission(role, permissions, "staff");
}

/** يطبّع مصفوفة صلاحيات واردة إلى مفاتيح صالحة فقط (بلا تكرار). */
export function sanitizePermissions(input: string[]): AdminPermission[] {
  const valid = new Set<AdminPermission>();
  for (const p of input) {
    if ((ADMIN_PERMISSIONS as readonly string[]).includes(p)) valid.add(p as AdminPermission);
  }
  return [...valid];
}
