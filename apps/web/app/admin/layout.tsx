"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut, ArrowRight } from "lucide-react";
import { ar } from "@al-souq/i18n";
import { trpc } from "@/src/trpc/react";

// أقسام مجمّعة منطقياً — تظهر في قائمة جانبية نظيفة بدل شريط أفقي مزدحم.
const GROUPS: { title: string; items: { href: string; label: string }[] }[] = [
  {
    title: "العمليات",
    items: [
      { href: "/admin", label: "المؤشرات" },
      { href: "/admin/orders", label: "الطلبات" },
      { href: "/admin/vendors", label: "البائعون" },
      { href: "/admin/products", label: "مراجعة المنتجات" },
    ],
  },
  {
    title: "المالية",
    items: [
      { href: "/admin/finance", label: "المالية والمحاسبة" },
      { href: "/admin/payouts", label: "التسويات" },
    ],
  },
  { title: "الكتالوج", items: [{ href: "/admin/categories", label: "الفئات" }] },
  {
    title: "النظام",
    items: [
      { href: "/admin/users", label: "المستخدمون" },
      { href: "/admin/settings", label: "الإعدادات" },
      { href: "/admin/audit", label: "سجل التدقيق" },
    ],
  },
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      router.replace("/login");
      router.refresh();
    },
  });

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  // عنوان الصفحة الحالي (أطول تطابق أولاً حتى تُصيب صفحات التفاصيل قسمها الصحيح).
  const current = [...ALL_ITEMS].sort((a, b) => b.href.length - a.href.length).find((i) => isActive(i.href));
  const title = current?.label ?? "لوحة الإدارة";
  const isHome = pathname === "/admin";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-900 text-white">
        <div className="container-app flex h-14 items-center justify-between gap-2">
          {isHome ? (
            <span className="w-9" aria-hidden />
          ) : (
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
              aria-label="رجوع"
            >
              <ArrowRight className="h-5 w-5" />
              <span className="hidden sm:inline">رجوع</span>
            </button>
          )}
          <span className="truncate font-bold">🛡️ {title}</span>
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg p-1.5 text-neutral-300 hover:bg-neutral-800"
            aria-label="القائمة"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="container-app flex-1 py-4">{children}</main>

      {/* القائمة الجانبية */}
      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 start-0 flex w-72 max-w-[82%] flex-col bg-white shadow-xl">
            <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-neutral-100 px-4">
              <span className="font-bold">🛡️ لوحة الإدارة</span>
              <button onClick={() => setOpen(false)} aria-label="إغلاق" className="rounded-lg p-1 hover:bg-neutral-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {GROUPS.map((g) => (
                <div key={g.title} className="mb-3">
                  <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    {g.title}
                  </p>
                  {g.items.map((n) => (
                    <Link
                      key={n.href}
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className={`block rounded-lg px-3 py-2 text-sm ${
                        isActive(n.href) ? "bg-brand-50 font-semibold text-brand-700" : "text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      {n.label}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
            <button
              onClick={() => logout.mutate({})}
              className="flex flex-shrink-0 items-center gap-2 border-t border-neutral-100 px-4 py-3 text-sm text-danger hover:bg-neutral-50"
            >
              <LogOut className="h-4 w-4" />
              {ar.auth.logout}
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
