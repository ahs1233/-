import Link from "next/link";
import { ChevronLeft, TrendingUp, Tag, Package, DoorOpen, Award } from "lucide-react";
import type { PulseEvent, PulseKind } from "@al-souq/api";

const ICON: Record<PulseKind, { icon: typeof Tag; color: string; wrap: string }> = {
  live: { icon: Package, color: "text-gold-400", wrap: "bg-gold-500/10" },
  trend: { icon: TrendingUp, color: "text-danger", wrap: "bg-danger/10" },
  offer: { icon: Tag, color: "text-gold-400", wrap: "bg-gold-500/10" },
  new_store: { icon: DoorOpen, color: "text-petrol", wrap: "bg-petrol/15" },
  milestone: { icon: Award, color: "text-brand-300", wrap: "bg-brand-500/20" },
};

/** نبض السوگ — شبكةٌ مدمجة (٢×٢) من آخر ما يحدث في السوق. */
export function PulseGrid({ events, title = "نبض السوگ" }: { events: PulseEvent[]; title?: string }) {
  const items = events.slice(0, 4);
  if (items.length === 0) return null;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-neutral-100">
          <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
          {title}
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-petrol">
            <span className="h-1.5 w-1.5 rounded-full bg-petrol" /> مباشر
          </span>
        </h2>
        <Link href="/market/stores" className="flex items-center gap-0.5 text-sm font-medium text-gold-400 hover:text-gold-300">
          عرض الكل <ChevronLeft className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((e) => {
          const cfg = ICON[e.kind];
          const Icon = cfg.icon;
          return (
            <div key={e.id} className="bg-card2 flex items-start gap-2.5 rounded-2xl border border-line p-3">
              <span className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl ${cfg.wrap}`}>
                <Icon className={`h-4 w-4 ${cfg.color}`} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-xs font-semibold leading-snug text-neutral-100">{e.text}</p>
                <p className="mt-0.5 text-[10px] text-neutral-500">{e.when}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
