"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { ar } from "@al-souq/i18n";
import { trpc } from "@/src/trpc/react";

const NAV = [
  { href: "/vendor", label: "نظرة عامة" },
  { href: "/vendor/products", label: ar.vendor.products },
  { href: "/vendor/orders", label: ar.vendor.orders },
  { href: "/vendor/statement", label: "كشف الحساب" },
  { href: "/vendor/payouts", label: ar.vendor.payouts },
  { href: "/vendor/settings", label: ar.vendor.settings },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const me = trpc.vendor.me.useQuery(undefined, { retry: false });
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      router.replace("/login");
      router.refresh();
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white">
        <div className="container-app flex h-14 items-center justify-between">
          <Link href="/vendor" className="flex flex-col leading-tight">
            <span className="text-lg font-bold text-brand-600">
              {me.data?.storeName ?? ar.vendor.dashboard}
            </span>
            <span className="text-[11px] text-neutral-400">{ar.vendor.dashboard}</span>
          </Link>
          <button
            onClick={() => logout.mutate({})}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-danger"
          >
            <LogOut className="h-4 w-4" />
            {ar.auth.logout}
          </button>
        </div>
        <nav className="container-app flex gap-1 overflow-x-auto pb-2">
          {NAV.map((n) => {
            const active = n.href === "/vendor" ? pathname === "/vendor" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-sm ${
                  active ? "bg-brand-500 text-white" : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {me.data && me.data.status !== "APPROVED" && (
        <div className="bg-gold-400/20 px-4 py-2 text-center text-sm text-gold-600">
          {me.data.status === "PENDING"
            ? "حسابك قيد المراجعة من الإدارة. يمكنك تجهيز منتجاتك كمسودّات."
            : me.data.status === "SUSPENDED"
              ? "حسابك معلّق. تواصل مع الإدارة."
              : `تم رفض الطلب${me.data.rejectionNote ? `: ${me.data.rejectionNote}` : ""}`}
        </div>
      )}

      <main className="container-app flex-1 py-4">{children}</main>
    </div>
  );
}
