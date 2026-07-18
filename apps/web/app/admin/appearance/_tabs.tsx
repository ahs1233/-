"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Palette, LayoutList, LayoutGrid, Tags, MapPin, Megaphone, Newspaper, Store } from "lucide-react";

// تبويبات «المظهر» — شريطٌ ثابت يجعل كلّ محرّرٍ (ومنه «الإعلانات» و«المحتوى») على بُعد نقرةٍ واحدة.
const TABS: { href: string; label: string; icon: typeof Palette; match: string }[] = [
  { href: "/admin/appearance/theme", label: "الألوان", icon: Palette, match: "/admin/appearance/theme" },
  { href: "/admin/appearance/sections", label: "التخطيط", icon: LayoutList, match: "/admin/appearance/sections" },
  { href: "/admin/appearance/markets", label: "الأسواق", icon: LayoutGrid, match: "/admin/appearance/markets" },
  { href: "/admin/appearance/stores", label: "المتاجر", icon: Store, match: "/admin/appearance/stores" },
  { href: "/admin/categories", label: "الفئات", icon: Tags, match: "/admin/categories" },
  { href: "/admin/appearance/governorates", label: "المحافظات", icon: MapPin, match: "/admin/appearance/governorates" },
  { href: "/admin/appearance/ads", label: "الإعلانات", icon: Megaphone, match: "/admin/appearance/ads" },
  { href: "/admin/appearance/content", label: "المحتوى", icon: Newspaper, match: "/admin/appearance/content" },
];

export function AppearanceTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-5">
      <div className="flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        {TABS.map((t) => {
          const active = pathname.startsWith(t.match);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-brand-700 text-white shadow-sm"
                  : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50 hover:text-brand-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
