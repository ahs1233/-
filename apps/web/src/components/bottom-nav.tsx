"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Heart, Bell, Mail, User } from "lucide-react";
import { trpc } from "@/src/trpc/react";

const ITEMS = [
  { href: "/", label: "الرئيسية", icon: Home },
  { href: "/favorites", label: "المفضلة", icon: Heart },
  { href: "/notifications", label: "الإشعارات", icon: Bell, badge: true },
  { href: "/messages", label: "رسائلي", icon: Mail },
  { href: "/account", label: "حسابي", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const unread = trpc.notification.unreadCount.useQuery(undefined, { retry: false });

  return (
    <nav className="bg-card sticky bottom-0 z-20 border-t border-line pb-[env(safe-area-inset-bottom)] text-white shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.7)]">
      <ul className="container-app flex items-center justify-between py-1.5">
        {ITEMS.map((it) => {
          const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          const Icon = it.icon;
          const count = it.badge ? (unread.data ?? 0) : 0;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={`relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] transition ${
                  active ? "font-semibold text-gold-400" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-gold-400" : "text-neutral-400"}`} />
                {it.label}
                {count > 0 && (
                  <span className="absolute end-1 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white nums">
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
