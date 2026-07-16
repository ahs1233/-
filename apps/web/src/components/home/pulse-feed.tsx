"use client";

import { useState } from "react";
import { TrendingUp, Tag, Package, DoorOpen, Award } from "lucide-react";
import type { PulseEvent, PulseKind } from "@al-souq/api";

const ICON: Record<PulseKind, { icon: typeof Tag; color: string; wrap: string }> = {
  live: { icon: Package, color: "text-gold-400", wrap: "bg-gold-500/10" },
  trend: { icon: TrendingUp, color: "text-clay", wrap: "bg-clay/10" },
  offer: { icon: Tag, color: "text-gold-400", wrap: "bg-gold-500/10" },
  new_store: { icon: DoorOpen, color: "text-petrol", wrap: "bg-petrol/15" },
  milestone: { icon: Award, color: "text-brand-300", wrap: "bg-brand-500/20" },
};

// تبويبات التصفية — كلٌّ منها يجمع نوعاً أو أكثر من أحداث النبض.
const FILTERS: { key: string; label: string; kinds: PulseKind[] | null }[] = [
  { key: "all", label: "الكل", kinds: null },
  { key: "stores", label: "متاجر", kinds: ["new_store", "milestone"] },
  { key: "offers", label: "عروض", kinds: ["offer"] },
  { key: "products", label: "منتجات", kinds: ["live"] },
  { key: "news", label: "أخبار", kinds: ["trend"] },
];

export function PulseFeed({ events }: { events: PulseEvent[] }) {
  const [active, setActive] = useState("all");
  const filter = FILTERS.find((f) => f.key === active) ?? FILTERS[0]!;
  const shown = filter.kinds ? events.filter((e) => filter.kinds!.includes(e.kind)) : events;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => {
          const on = f.key === active;
          const count = f.kinds ? events.filter((e) => f.kinds!.includes(e.kind)).length : events.length;
          return (
            <button
              key={f.key}
              onClick={() => setActive(f.key)}
              className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                on ? "bg-gold-500 text-brand-900" : "bg-card2 border border-line text-neutral-300 hover:border-gold-500/40"
              }`}
            >
              {f.label}
              {count > 0 && <span className="ms-1 text-xs opacity-70 nums">{count}</span>}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-10 text-center text-neutral-500">لا يوجد نشاطٌ في هذا التصنيف بعد.</p>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((e) => {
            const cfg = ICON[e.kind];
            const Icon = cfg.icon;
            return (
              <li key={e.id} className="bg-card flex items-center gap-3 rounded-2xl border border-line px-3.5 py-3 shadow-sm">
                <span className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl ${cfg.wrap}`}>
                  <Icon className={`h-5 w-5 ${cfg.color}`} />
                </span>
                <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-neutral-200">{e.text}</p>
                <span className="flex-shrink-0 self-start text-[10px] text-neutral-500">{e.when}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
