import Link from "next/link";
import { Radio, TrendingUp, Tag, Store, ChevronLeft, BadgeCheck, Star } from "lucide-react";
import { AppImage } from "@/src/components/app-image";
import type { HomeStats, FeaturedEntity, PulseEvent, PulseKind } from "@al-souq/api";

/* ── شريط الأرقام الحيّة (نبض السوق رقماً) ── */
export function StatStrip({ stats, governorate }: { stats: HomeStats; governorate?: string }) {
  const cells = [
    { n: stats.openStores, label: `محل مفتوح${governorate ? "" : " الآن"}`, live: true },
    { n: stats.newStoresToday, label: "جهة جديدة اليوم", live: false },
    { n: stats.newOffersToday, label: "عرض جديد اليوم", live: true },
  ];
  return (
    <div className="grid grid-cols-3 divide-x divide-x-reverse divide-sand-200 rounded-2xl border border-sand-200 bg-white/80 shadow-sm">
      {cells.map((c, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5 px-2 py-3 text-center">
          <span className="flex items-center gap-1.5">
            {c.live && <span className="h-1.5 w-1.5 rounded-full bg-petrol" />}
            <span className="text-xl font-extrabold text-brand-800 nums">{c.n}</span>
          </span>
          <span className="text-[11px] font-medium text-neutral-500">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── جهة موصى بها لك (بطاقة نيليّة كبيرة) ── */
export function FeaturedEntityCard({ entity }: { entity: FeaturedEntity }) {
  const photo = entity.bannerUrl ?? entity.logoUrl ?? "/souks/souk-lantern.jpg";
  return (
    <section className="overflow-hidden rounded-3xl bg-brand-700 text-white shadow-lg ring-1 ring-brand-800">
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-base font-extrabold text-gold-300">جهة موصى بها لك</h2>
        <Link href="/stores" className="flex items-center gap-0.5 text-xs font-medium text-white/70">
          استكشف الكل <ChevronLeft className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="flex gap-3 p-4">
        <div className="relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/15">
          <AppImage src={photo} alt={entity.storeName} sizes="120px" className="h-full w-full object-cover" />
          <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-petrol/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
            <BadgeCheck className="h-3 w-3" /> موثوق
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-extrabold">{entity.storeName}</h3>
          <p className="mt-0.5 text-xs text-white/70">
            {entity.category ?? "متجر"}
            {entity.governorate ? ` · ${entity.governorate}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-white/70">في السوق منذ {entity.memberSinceYear}</p>
          {entity.ratingCount > 0 && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-sm font-bold text-gold-300">
              <Star className="h-3.5 w-3.5 fill-gold-400 text-gold-400" />
              {entity.ratingAvg.toFixed(1)}
              <span className="font-normal text-white/50">({entity.ratingCount})</span>
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px border-y border-white/10 bg-white/5 text-center">
        <Stat n={entity.ratingCount > 0 ? entity.ratingAvg.toFixed(1) : "—"} label="التقييم" />
        <Stat n={entity.productCount} label="منتج" />
        <Stat n={entity.ratingCount} label="مراجعة" />
      </div>

      <div className="p-4">
        <Link
          href={`/store/${entity.slug}`}
          className="btn-brass flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold text-[#16223b]"
        >
          دخول المتجر <ChevronLeft className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function Stat({ n, label }: { n: string | number; label: string }) {
  return (
    <div className="py-3">
      <div className="text-lg font-extrabold text-gold-300 nums">{n}</div>
      <div className="text-[11px] text-white/60">{label}</div>
    </div>
  );
}

/* ── السوق الآن (نبض حيّ) ── */
const PULSE_ICON: Record<PulseKind, { icon: typeof Radio; wrap: string; color: string }> = {
  live: { icon: Radio, wrap: "bg-gold-100 ring-gold-200", color: "text-gold-600" },
  trend: { icon: TrendingUp, wrap: "bg-petrol/10 ring-petrol/20", color: "text-petrol" },
  offer: { icon: Tag, wrap: "bg-clay/10 ring-clay/20", color: "text-clay" },
  new_store: { icon: Store, wrap: "bg-brand-100 ring-brand-200", color: "text-brand-600" },
};

export function MarketPulse({ events }: { events: PulseEvent[] }) {
  if (!events.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-800">
          <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
          السوق الآن
        </h2>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-petrol">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-petrol" /> مباشر
        </span>
      </div>
      <div className="divide-y divide-sand-200 overflow-hidden rounded-2xl border border-sand-200 bg-white/70">
        {events.map((e) => {
          const cfg = PULSE_ICON[e.kind];
          const Icon = cfg.icon;
          return (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3">
              <span className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl ring-1 ${cfg.wrap}`}>
                <Icon className={`h-4 w-4 ${cfg.color}`} />
              </span>
              <p className="min-w-0 flex-1 text-sm font-medium text-neutral-800">{e.text}</p>
              <span className="flex-shrink-0 text-[11px] text-neutral-400">{e.when}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── تصفّح الأسواق (بلاطات مصوّرة) ── */
const SOUKS = [
  { label: "الشورجة", img: "/souks/souk-shorja.jpg", q: "الشورجة" },
  { label: "الحرفيّون", img: "/souks/souk-craft.jpg", q: "حرفي" },
  { label: "النحاسيّات", img: "/souks/souk-lantern.jpg", q: "نحاس" },
  { label: "العطور والبخور", img: "/souks/souk-spice.jpg", q: "عطور" },
  { label: "المكتبات", img: "/souks/souk-books.jpg", q: "كتب" },
  { label: "العبايات", img: "/souks/souk-abaya.jpg", q: "عباية" },
];

export function SoukTiles({ governorate }: { governorate?: string }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-800">
          <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
          <span aria-hidden>🕌</span>
          أسواق {governorate ?? "العراق"}
        </h2>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SOUKS.map((s) => (
          <Link
            key={s.label}
            href={`/search?q=${encodeURIComponent(s.q)}`}
            className="group relative h-36 w-32 flex-shrink-0 overflow-hidden rounded-2xl ring-1 ring-brand-800/20"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.img}
              alt={s.label}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-900/85 via-brand-900/20 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 p-2.5 text-sm font-bold text-white drop-shadow">
              {s.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
