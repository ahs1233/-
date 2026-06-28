"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

  const suggest = trpc.catalog.suggest.useQuery(
    { q: debounced },
    { enabled: debounced.length >= 2, staleTime: 30_000 },
  );

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="container-app flex h-14 items-center gap-3">
        <Link href="/" className="text-xl font-bold text-brand-600">
          {ar.common.appName}
        </Link>

        <div ref={boxRef} className="relative flex-1">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
            }}
          >
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
              className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
            />
          </form>

          {open && debounced.length >= 2 && (suggest.data?.products.length || suggest.data?.categories.length) ? (
            <div className="absolute inset-x-0 top-11 z-30 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
              {suggest.data?.categories.map((c) => (
                <button
                  key={`c-${c.slug}`}
                  onClick={() => go(`/category/${c.slug}`)}
                  className="block w-full px-3 py-2 text-right text-sm hover:bg-neutral-50"
                >
                  📂 {c.nameAr}
                </button>
              ))}
              {suggest.data?.products.map((p) => (
                <button
                  key={`p-${p.slug}`}
                  onClick={() => go(`/product/${p.slug}`)}
                  className="block w-full truncate px-3 py-2 text-right text-sm hover:bg-neutral-50"
                >
                  🔍 {p.title}
                </button>
              ))}
            </div>
          ) : null}
        </div>

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
