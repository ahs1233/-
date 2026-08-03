import Link from "next/link";
import { Boxes, Sparkles, TrendingUp, Tag, Radio } from "lucide-react";
import { timeAgoAr } from "@/src/lib/store-hours";

export interface PulseItem {
  id: string;
  kind: string;
  message: string;
  sponsored?: boolean;
  at: string;
  store: { storeName: string; slug: string; logoUrl: string | null };
}

function KindIcon({ kind }: { kind: string }) {
  const cls = "h-4 w-4";
  if (kind === "restock" || kind === "new_arrival") return <Boxes className={cls} />;
  if (kind === "new_section") return <Sparkles className={cls} />;
  if (kind === "most_visited") return <TrendingUp className={cls} />;
  if (kind === "promo") return <Tag className={cls} />;
  return <Sparkles className={cls} />;
}

/** نبض السوق — تغذيةٌ حيّةٌ لأحداث المتاجر (وصول دفعة، افتتاح قسم، الأكثر زيارة…). */
export function MarketPulse({ items }: { items: PulseItem[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-neutral-100">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-petrol opacity-70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-petrol" />
        </span>
        نبض السوق
        <Radio className="h-4 w-4 text-neutral-500" />
      </h2>
      <ul className="space-y-2">
        {items.map((a) => (
          <li key={a.id}>
            <Link
              href={`/store/${a.store.slug}`}
              className="bg-card group flex items-center gap-3 rounded-2xl border border-line p-3 shadow-sm transition hover:border-gold-500/40"
            >
              <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-gold-500/10 text-gold-300">
                <KindIcon kind={a.kind} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm text-neutral-200">
                  <span className="truncate">{a.message}</span>
                  {a.sponsored && <span className="flex-shrink-0 rounded-full bg-gold-500/20 px-1.5 py-0.5 text-[9px] font-bold text-gold-300">مموّل</span>}
                </p>
                <p className="truncate text-[11px] text-neutral-500">
                  <span className="font-semibold text-gold-400">{a.store.storeName}</span> · {timeAgoAr(a.at)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
