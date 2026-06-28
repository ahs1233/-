"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ar } from "@al-souq/i18n";
import { trpc } from "@/src/trpc/react";

const NAV = [
  { href: "/vendor", label: "نظرة عامة" },
  { href: "/vendor/products", label: ar.vendor.products },
  { href: "/vendor/orders", label: ar.vendor.orders },
  { href: "/vendor/payouts", label: ar.vendor.payouts },
  { href: "/vendor/settings", label: ar.vendor.settings },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const me = trpc.vendor.me.useQuery(undefined, { retry: false });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white">
        <div className="container-app flex h-14 items-center justify-between">
          <Link href="/vendor" className="text-lg font-bold text-brand-600">
            {ar.vendor.dashboard}
          </Link>
          <Link href="/" className="text-sm text-neutral-500">
            ← المتجر
          </Link>
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
