"use client";

import Link from "next/link";
import { ar } from "@al-souq/i18n";
import { trpc } from "@/src/trpc/react";
import { useCart } from "@/src/store/cart";

export function Header() {
  const count = useCart((s) => s.count());
  // عدّاد الإشعارات غير المقروءة — يفشل بصمت إن لم يكن مسجّلاً الدخول
  const unread = trpc.notification.unreadCount.useQuery(undefined, { retry: false });

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="container-app flex h-14 items-center gap-3">
        <Link href="/" className="text-xl font-bold text-brand-600">
          {ar.common.appName}
        </Link>
        <form action="/search" className="flex-1">
          <input
            name="q"
            type="search"
            placeholder={ar.common.search}
            className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
          />
        </form>
        <Link href="/notifications" className="relative text-xl" aria-label="الإشعارات">
          🔔
          {(unread.data ?? 0) > 0 && (
            <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] text-white nums">
              {unread.data}
            </span>
          )}
        </Link>
        <Link href="/cart" className="relative text-xl" aria-label={ar.nav.cart}>
          🛒
          {count > 0 && (
            <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] text-white nums">
              {count}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
