"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, LayoutGrid } from "lucide-react";
import { ar } from "@al-souq/i18n";
import { trpc } from "@/src/trpc/react";
import { useCart } from "@/src/store/cart";
import { BrandMark } from "@/src/components/brand-logo";
import { GovPill } from "@/src/components/governorate/gov-pill";

export function Header({ gov }: { gov: { id: string; name: string } | null }) {
  const router = useRouter();
  const count = useCart((s) => s.count());

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
    <header className="bg-page/95 sticky top-0 z-20 border-b border-line backdrop-blur-md">
      <div className="container-app flex h-16 items-center gap-2">
        <Link href="/" className="flex flex-shrink-0 items-center gap-1.5 text-xl font-extrabold text-gold-400" aria-label={ar.common.appName}>
          <BrandMark className="h-8 w-8" />
          <span className="hidden text-gold-300 sm:inline">{ar.common.appName}</span>
        </Link>

        <div ref={boxRef} className="relative flex-1">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
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
              className="bg-card2 h-11 w-full rounded-xl border border-line pe-9 ps-3 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-500 focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
            />
          </form>

          {open && debounced.length >= 2 && (suggest.data?.products.length || suggest.data?.categories.length) ? (
            <div className="bg-card absolute inset-x-0 top-12 z-30 overflow-hidden rounded-xl border border-line shadow-xl">
              {suggest.data?.categories.map((c) => (
                <button
                  key={`c-${c.slug}`}
                  onClick={() => go(`/category/${c.slug}`)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-right text-sm text-neutral-200 hover:bg-card2"
                >
                  <LayoutGrid className="h-4 w-4 text-gold-400" /> {c.nameAr}
                </button>
              ))}
              {suggest.data?.products.map((p) => (
                <button
                  key={`p-${p.slug}`}
                  onClick={() => go(`/product/${p.slug}`)}
                  className="flex w-full items-center gap-2 truncate px-3 py-2.5 text-right text-sm text-neutral-200 hover:bg-card2"
                >
                  <Search className="h-4 w-4 text-neutral-500" /> {p.title}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <Link href="/cart" className="relative grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl text-neutral-300 hover:bg-card2" aria-label={ar.nav.cart}>
          <ShoppingCart className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute end-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-brand-900 nums">
              {count}
            </span>
          )}
        </Link>
        <GovPill current={gov} />
      </div>
    </header>
  );
}
