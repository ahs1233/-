"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ArrowRight } from "lucide-react";
import { ar } from "@al-souq/i18n";
import { trpc } from "@/src/trpc/react";

// أقسام لوحة الإدارة — تُعرض في شريط علوي عرضي، وتُقيَّد حسب صلاحية الموظف.
const NAV: { href: string; label: string; perm: string }[] = [
  { href: "/admin", label: "المؤشرات", perm: "dashboard" },
  { href: "/admin/orders", label: "الطلبات", perm: "orders" },
  { href: "/admin/vendors", label: "المتاجر", perm: "vendors" },
  { href: "/admin/products", label: "مراجعة المنتجات", perm: "products" },
  { href: "/admin/finance", label: "المالية", perm: "finance" },
  { href: "/admin/payouts", label: "التسويات", perm: "finance" },
  { href: "/admin/categories", label: "الفئات", perm: "categories" },
  { href: "/admin/coupons", label: "الكوبونات", perm: "coupons" },
  { href: "/admin/users", label: "المستخدمون", perm: "users" },
  { href: "/admin/staff", label: "الموظفون", perm: "staff" },
  { href: "/admin/settings", label: "الإعدادات", perm: "settings" },
  { href: "/admin/appearance", label: "المظهر", perm: "settings" },
  { href: "/admin/audit", label: "التدقيق", perm: "audit" },
];

const isActive = (pathname: string, href: string) =>
  href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const me = trpc.admin.me.useQuery(undefined, { retry: false, staleTime: 60_000 });
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      router.replace("/login");
      router.refresh();
    },
  });

  // تقييد الأقسام حسب صلاحيات الموظف (قبل التحميل نعرض المؤشرات فقط لتفادي وميض).
  const perms: string[] | null = me.data?.permissions ?? null;
  const items = perms ? NAV.filter((n) => perms.includes(n.perm)) : NAV.filter((n) => n.href === "/admin");

  // عنوان الصفحة الحالية + هل هي صفحة تفاصيل (أعمق من جذر قسم).
  const current = [...NAV].sort((a, b) => b.href.length - a.href.length).find((i) => isActive(pathname, i.href));
  const isDetail = !NAV.some((i) => i.href === pathname);

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      {/* شريط علوي: العلامة + العنوان + الخروج */}
      <header className="sticky top-0 z-30 bg-neutral-900 text-white">
        <div className="container-app flex h-14 items-center gap-2">
          {isDetail && (
            <button onClick={() => router.back()} aria-label="رجوع" className="rounded-lg p-1.5 hover:bg-white/10">
              <ArrowRight className="h-5 w-5" />
            </button>
          )}
          <Link href="/admin" className="font-bold">
            🛡️ لوحة الإدارة
          </Link>
          {isDetail && current && (
            <span className="truncate text-sm text-neutral-400">/ {current.label}</span>
          )}
          {me.data?.staffTitle && (
            <span className="ms-2 hidden rounded-full bg-white/10 px-2 py-0.5 text-xs text-neutral-300 sm:inline">
              {me.data.staffTitle}
            </span>
          )}
          <button
            onClick={() => logout.mutate({})}
            aria-label="تسجيل الخروج"
            className="ms-auto flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-neutral-300 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{ar.auth.logout}</span>
          </button>
        </div>

        {/* شريط الأقسام العرضي — قابل للتمرير أفقياً على الجوال، ويلتفّ على الشاشات الكبيرة */}
        <nav className="border-t border-white/10">
          <div className="container-app flex gap-1 overflow-x-auto py-2 lg:flex-wrap lg:overflow-visible">
            {items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
                  isActive(pathname, n.href)
                    ? "bg-white text-neutral-900 font-semibold"
                    : "text-neutral-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main className="container-app flex-1 py-4">{children}</main>
    </div>
  );
}
