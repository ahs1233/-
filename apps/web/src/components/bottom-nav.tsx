"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ar } from "@al-souq/i18n";
import { useCart } from "@/src/store/cart";

const ITEMS = [
  { href: "/", label: ar.nav.home },
  { href: "/categories", label: ar.nav.categories },
  { href: "/cart", label: ar.nav.cart, cart: true },
  { href: "/orders", label: ar.nav.orders },
  { href: "/account", label: ar.nav.account },
];

export function BottomNav() {
  const pathname = usePathname();
  const count = useCart((s) => s.count());

  return (
    <nav className="sticky bottom-0 z-20 border-t border-neutral-200 bg-white md:hidden">
      <ul className="container-app flex items-center justify-between py-2">
        {ITEMS.map((it) => {
          const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={`relative block px-2 py-1 text-xs ${active ? "font-bold text-brand-600" : "text-neutral-600"}`}
              >
                {it.label}
                {it.cart && count > 0 && (
                  <span className="absolute -top-1 start-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] text-white nums">
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
