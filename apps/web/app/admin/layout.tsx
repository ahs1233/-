"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut, ArrowRight } from "lucide-react";
import { ar } from "@al-souq/i18n";
import { trpc } from "@/src/trpc/react";

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
const isActive = (pathname: string, href: string) =>
  href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-2">
      {GROUPS.map((g) => (
        <div key={g.title} className="mb-3">
          <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{g.title}</p>
          {g.items.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={onNavigate}
              className={`block rounded-lg px-3 py-2 text-sm ${
                isActive(pathname, n.href)
                  ? "bg-white/10 font-semibold text-white"
                  : "text-neutral-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}

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

  const current = [...ALL_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => isActive(pathname, i.href));
  const title = current?.label ?? "لوحة الإدارة";
  // صفحة تفاصيل = أعمق من جذر قسم (مثل /admin/orders/[id]) → نعرض زرّ رجوع بدل القائمة.
  const isDetail = !ALL_ITEMS.some((i) => i.href === pathname);

  const Brand = <span className="font-bold">🛡️ لوحة الإدارة</span>;
  const LogoutBtn = (
    <button
      onClick={() => logout.mutate({})}
      className="flex flex-shrink-0 items-center gap-2 border-t border-white/10 px-4 py-3 text-sm text-neutral-300 hover:bg-white/5 hover:text-white"
    >
      <LogOut className="h-4 w-4" />
      {ar.auth.logout}
    </button>
  );

  return (
    <div className="flex min-h-screen bg-neutral-50">
      {/* شريط جانبي ثابت على الشاشات الكبيرة (يمين في RTL) */}
      <aside className="hidden w-64 flex-shrink-0 flex-col bg-neutral-900 text-white md:flex">
        <div className="flex h-14 flex-shrink-0 items-center px-4">{Brand}</div>
        <NavLinks pathname={pathname} />
        {LogoutBtn}
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        {/* شريط علوي على الجوال فقط: زرّ القائمة (☰) يمين، ثم العنوان، ثم الخروج */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-3 text-white md:hidden">
          {isDetail ? (
            <button onClick={() => router.back()} aria-label="رجوع" className="rounded-lg p-1.5 hover:bg-neutral-800">
              <ArrowRight className="h-5 w-5" />
            </button>
          ) : (
            <button onClick={() => setOpen(true)} aria-label="القائمة" className="rounded-lg p-1.5 hover:bg-neutral-800">
              <Menu className="h-5 w-5" />
            </button>
          )}
          <span className="flex-1 truncate font-bold">🛡️ {title}</span>
          <button
            onClick={() => logout.mutate({})}
            aria-label="تسجيل الخروج"
            className="rounded-lg p-1.5 text-neutral-300 hover:bg-neutral-800"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        <main className="container-app flex-1 py-4">{children}</main>
      </div>

      {/* القائمة الجانبية على الجوال (تنزلق من اليمين) */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 flex w-72 max-w-[82%] flex-col bg-neutral-900 text-white shadow-xl">
            <div className="flex h-14 flex-shrink-0 items-center justify-between px-4">
              {Brand}
              <button onClick={() => setOpen(false)} aria-label="إغلاق" className="rounded-lg p-1 hover:bg-neutral-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            {LogoutBtn}
          </div>
        </div>
      )}
    </div>
  );
}
