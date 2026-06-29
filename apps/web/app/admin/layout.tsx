"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "المؤشرات" },
  { href: "/admin/vendors", label: "البائعون" },
  { href: "/admin/products", label: "مراجعة المنتجات" },
  { href: "/admin/categories", label: "الفئات" },
  { href: "/admin/orders", label: "الطلبات" },
  { href: "/admin/payouts", label: "التسويات" },
  { href: "/admin/users", label: "المستخدمون" },
  { href: "/admin/settings", label: "الإعدادات" },
  { href: "/admin/audit", label: "سجل التدقيق" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-neutral-900 text-white">
        <div className="container-app flex h-14 items-center justify-between">
          <Link href="/admin" className="text-lg font-bold">
            🛡️ لوحة الإدارة
          </Link>
          <Link href="/" className="text-sm text-neutral-300">
            ← الموقع
          </Link>
        </div>
        <nav className="container-app flex gap-1 overflow-x-auto pb-2">
          {NAV.map((n) => {
            const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-sm ${
                  active ? "bg-white text-neutral-900" : "text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="container-app flex-1 py-4">{children}</main>
    </div>
  );
}
