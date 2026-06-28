import Link from "next/link";
import { ar } from "@al-souq/i18n";

const ITEMS = [
  { href: "/", label: ar.nav.home },
  { href: "/categories", label: ar.nav.categories },
  { href: "/cart", label: ar.nav.cart },
  { href: "/orders", label: ar.nav.orders },
  { href: "/account", label: ar.nav.account },
];

export function BottomNav() {
  return (
    <nav className="sticky bottom-0 z-20 border-t border-neutral-200 bg-white md:hidden">
      <ul className="container-app flex items-center justify-between py-2">
        {ITEMS.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              className="block px-2 py-1 text-xs text-neutral-600 hover:text-brand-600"
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
