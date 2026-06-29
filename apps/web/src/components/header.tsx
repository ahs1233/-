"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Bell, ShoppingCart, LayoutGrid } from "lucide-react";
import { ar } from "@al-souq/i18n";
import { trpc } from "@/src/trpc/react";
import { useCart } from "@/src/store/cart";

export function Header() {
  const router = useRouter();
  const count = useCart((s) => s.count());
  const unread = trpc.notification.unreadCount.useQuery(undefined, { retry: false });

  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const govId =
    typeof document !== "undefined"
      ? (document.cookie.match(/(?:^|;\s*)al_gov=([^;]+)/)?.[1] ?? undefined)
      : undefined;
  const suggest = trpc.catalog.suggest.useQuery(
    { q: debounced, governorateId: govId },
    { enabled: debounced.length >= 2, staleTime: 30_000 },
  );

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur-md">
      <div className="container-app flex h-16 items-center gap-2">
        <Link href="/" className="flex items-center gap-1 text-2xl font-extrabold text-brand-600">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-base text-white shadow-sm">سو</span>
          <span className="hidden sm:inline">{ar.common.appName}</span>
        </Link>

        <div ref={boxRef} className="relative flex-1">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              name="q"
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={ar.common.search}
              className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 pe-9 ps-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
          </form>

          {open && debounced.length >= 2 && (suggest.data?.products.length || suggest.data?.categories.length) ? (
            <div className="absolute inset-x-0 top-12 z-30 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
              {suggest.data?.categories.map((c) => (
                <button
                  key={`c-${c.slug}`}
                  onClick={() => go(`/category/${c.slug}`)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-right text-sm hover:bg-neutral-50"
                >
                  <LayoutGrid className="h-4 w-4 text-brand-500" /> {c.nameAr}
                </button>
              ))}
              {suggest.data?.products.map((p) => (
                <button
                  key={`p-${p.slug}`}
                  onClick={() => go(`/product/${p.slug}`)}
                  className="flex w-full items-center gap-2 truncate px-3 py-2.5 text-right text-sm hover:bg-neutral-50"
                >
                  <Search className="h-4 w-4 text-neutral-400" /> {p.title}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <Link href="/notifications" className="relative grid h-10 w-10 place-items-center rounded-xl text-neutral-600 hover:bg-neutral-100" aria-label="الإشعارات">
          <Bell className="h-5 w-5" />
          {(unread.data ?? 0) > 0 && (
            <span className="absolute end-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] text-white nums">
              {unread.data}
            </span>
          )}
        </Link>
        <Link href="/cart" className="relative grid h-10 w-10 place-items-center rounded-xl text-neutral-600 hover:bg-neutral-100" aria-label={ar.nav.cart}>
          <ShoppingCart className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute end-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] text-white nums">
              {count}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
