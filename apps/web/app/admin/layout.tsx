"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ArrowRight } from "lucide-react";
import { ar } from "@al-souq/i18n";
import { trpc } from "@/src/trpc/react";

// أقسام لوحة الإدارة — تُعرض في شريط علوي عرضي.
const NAV: { href: string; label: string }[] = [
  { href: "/admin", label: "المؤشرات" },
  { href: "/admin/orders", label: "الطلبات" },
  { href: "/admin/vendors", label: "المتاجر" },
  { href: "/admin/products", label: "مراجعة المنتجات" },
  { href: "/admin/finance", label: "المالية" },
  { href: "/admin/payouts", label: "التسويات" },
  { href: "/admin/categories", label: "الفئات" },
  { href: "/admin/coupons", label: "الكوبونات" },
  { href: "/admin/users", label: "المستخدمون" },
  { href: "/admin/settings", label: "الإعدادات" },
  { href: "/admin/audit", label: "التدقيق" },
];

const isActive = (pathname: string, href: string) =>
  href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      router.replace("/login");
      router.refresh();
    },
  });

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
          <button
            onClick={() => logout.mutate({})}
            aria-label="تسجيل الخروج"
            className="ms-auto flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-neutral-300 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{ar.auth.logout}</span>
          </button>
        </div>

        {/* شريط الأقسام العرضي (قابل للتمرير أفقياً على الجوال) */}
        <nav className="border-t border-white/10">
          <div className="container-app flex gap-1 overflow-x-auto py-2">
            {NAV.map((n) => (
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
