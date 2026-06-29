"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, ShoppingCart, Package, User } from "lucide-react";
import { ar } from "@al-souq/i18n";
import { useCart } from "@/src/store/cart";

const ITEMS = [
  { href: "/", label: ar.nav.home, icon: Home },
  { href: "/categories", label: ar.nav.categories, icon: LayoutGrid },
  { href: "/cart", label: ar.nav.cart, icon: ShoppingCart, cart: true },
  { href: "/orders", label: ar.nav.orders, icon: Package },
  { href: "/account", label: ar.nav.account, icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const count = useCart((s) => s.count());

  return (
    <nav className="sticky bottom-0 z-20 border-t border-neutral-200 bg-white/95 backdrop-blur-md md:hidden">
      <ul className="container-app flex items-center justify-between py-1.5">
        {ITEMS.map((it) => {
          const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={`relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] transition ${
                  active ? "font-semibold text-brand-600" : "text-neutral-500"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-brand-600" : "text-neutral-500"}`} />
                {it.label}
                {it.cart && count > 0 && (
                  <span className="absolute end-1 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] text-white nums">
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
