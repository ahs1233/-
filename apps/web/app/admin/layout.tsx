"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { ar } from "@al-souq/i18n";
import { trpc } from "@/src/trpc/react";

// أقسام مجمّعة منطقياً بدل شريط أفقي مزدحم.
const GROUPS: { title: string; items: { href: string; label: string }[] }[] = [
  {
    title: "عمليات",
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
      { href: "/admin/finance", label: "المالية" },
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      router.replace("/login");
      router.refresh();
    },
  });

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-neutral-900 text-white">
        <div className="container-app flex h-14 items-center justify-between">
          <Link href="/admin" className="text-lg font-bold">
            🛡️ لوحة الإدارة
          </Link>
          <button
            onClick={() => logout.mutate({})}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            {ar.auth.logout}
          </button>
        </div>
        <nav className="container-app flex items-stretch gap-1 overflow-x-auto pb-2">
          {GROUPS.map((g, gi) => (
            <div key={g.title} className="flex items-center gap-1">
              {gi > 0 && <span className="mx-1 h-6 w-px flex-shrink-0 bg-neutral-700" aria-hidden />}
              <span className="flex-shrink-0 px-1 text-[10px] font-medium uppercase text-neutral-500">
                {g.title}
              </span>
              {g.items.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-sm ${
                    isActive(n.href) ? "bg-white text-neutral-900" : "text-neutral-300 hover:bg-neutral-800"
                  }`}
                >
                  {n.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </header>
      <main className="container-app flex-1 py-4">{children}</main>
    </div>
  );
}
