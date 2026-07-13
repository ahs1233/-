import Link from "next/link";
import { Radio, TrendingUp, Tag, Store, ChevronLeft, BadgeCheck, Star, Package, DoorOpen, Award, MapPin } from "lucide-react";
import { AppImage } from "@/src/components/app-image";
import { govIdentity } from "@/src/lib/governorate-identity";
import type { HomeStats, FeaturedEntity, PulseEvent, PulseKind, AdItem } from "@al-souq/api";

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

/* ── نبض السوق (حياةٌ لا منتجات) ── */
const PULSE_ICON: Record<PulseKind, { icon: typeof Radio; wrap: string; color: string; dot: string }> = {
  live: { icon: Package, wrap: "bg-gold-100 ring-gold-200", color: "text-gold-600", dot: "bg-gold-500" },
  trend: { icon: TrendingUp, wrap: "bg-clay/10 ring-clay/20", color: "text-clay", dot: "bg-clay" },
  offer: { icon: Tag, wrap: "bg-gold-100 ring-gold-200", color: "text-gold-600", dot: "bg-gold-500" },
  new_store: { icon: DoorOpen, wrap: "bg-petrol/10 ring-petrol/20", color: "text-petrol", dot: "bg-petrol" },
  milestone: { icon: Award, wrap: "bg-brand-100 ring-brand-200", color: "text-brand-600", dot: "bg-brand-500" },
};

/* ── لافتةٌ نيليّة كاملة العرض — تكسر رتابة العاجيّ وتصنع إيقاعاً بصريّاً ── */
export function DailyBanner({ governorate }: { governorate?: string }) {
  return (
    <Link
      href="/search"
      className="relative block overflow-hidden rounded-3xl ring-1 ring-brand-800/30"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/hero-souk.jpg" alt="" aria-hidden loading="lazy" className="h-40 w-full object-cover object-center sm:h-48" />
      <div className="absolute inset-0 bg-gradient-to-l from-brand-900/95 via-brand-900/70 to-brand-900/30" />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ backgroundImage: "radial-gradient(120px 80px at 18% 60%, rgba(255,196,96,.5), transparent 70%)" }}
      />
      <div className="absolute inset-0 flex flex-col justify-center p-5 sm:p-7">
        <span className="text-xs font-bold tracking-wide text-gold-300">عروض اليوم</span>
        <p className="mt-1 max-w-[16rem] text-xl font-extrabold leading-snug text-white drop-shadow sm:text-2xl">
          من قلب {governorate ?? "العراق"} — تشكيلةٌ مختارة اليوم
        </p>
        <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-2xl bg-white/15 px-4 py-2 text-sm font-bold text-white backdrop-blur">
          اكتشف العروض <ChevronLeft className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

/* ── الإعلانات — لافتات ترويجيّة يديرها الأدمن (تبويب الإعلانات) ── */
function AdBanner({ ad }: { ad: AdItem }) {
  return (
    <Link
      href={ad.linkUrl}
      className="relative block h-40 w-full flex-shrink-0 snap-start overflow-hidden rounded-3xl ring-1 ring-brand-800/30 sm:h-48"
    >
      <AppImage src={ad.imageUrl} alt={ad.title} sizes="(max-width: 768px) 100vw, 768px" className="h-full w-full object-cover object-center" />
      <div className="absolute inset-0 bg-gradient-to-l from-brand-900/95 via-brand-900/70 to-brand-900/25" />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ backgroundImage: "radial-gradient(120px 80px at 18% 60%, rgba(255,196,96,.5), transparent 70%)" }}
      />
      <div className="absolute inset-0 flex flex-col justify-center p-5 sm:p-7">
        <span className="text-xs font-bold tracking-wide text-gold-300">عروض اليوم</span>
        <p className="mt-1 max-w-[18rem] text-xl font-extrabold leading-snug text-white drop-shadow sm:text-2xl">{ad.title}</p>
        {ad.subtitle && <p className="mt-1 max-w-[18rem] text-sm text-white/85 drop-shadow">{ad.subtitle}</p>}
        <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-2xl bg-white/15 px-4 py-2 text-sm font-bold text-white backdrop-blur">
          اكتشف <ChevronLeft className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

/** لافتات الإعلانات — واحدةٌ ثابتة أو شريطٌ أفقيّ متعدّد؛ يرجع للّافتة الافتراضيّة عند غياب الإعلانات. */
export function AdsCarousel({ ads, governorate }: { ads: AdItem[]; governorate?: string }) {
  const banners = ads.filter((a) => a.placement === "home_banner");
  if (banners.length === 0) return <DailyBanner governorate={governorate} />;
  if (banners.length === 1) return <AdBanner ad={banners[0]!} />;
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {banners.map((ad) => (
        <div key={ad.id} className="w-[88%] flex-shrink-0 sm:w-[70%]">
          <AdBanner ad={ad} />
        </div>
      ))}
    </div>
  );
}

export function MarketPulse({ events, governorate, title }: { events: PulseEvent[]; governorate?: string; title?: string }) {
  if (!events.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-800">
          <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
          {title ?? `نبض ${governorate ?? "السوق"}`}
        </h2>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-petrol">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-petrol/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-petrol" />
          </span>
          مباشر
        </span>
      </div>
      <p className="mb-3 -mt-1 ps-3 text-xs text-neutral-500">ليست منتجات — بل حياةُ السوق اليوم</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {events.map((e) => {
          const cfg = PULSE_ICON[e.kind];
          const Icon = cfg.icon;
          return (
            <div
              key={e.id}
              className="flex items-center gap-3 rounded-2xl border border-sand-200 bg-white/80 px-3.5 py-3 shadow-sm"
            >
              <span className={`relative grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl ring-1 ${cfg.wrap}`}>
                <Icon className={`h-5 w-5 ${cfg.color}`} />
                <span className={`absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${cfg.dot}`} />
              </span>
              <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-neutral-800">{e.text}</p>
              <span className="flex-shrink-0 self-start text-[10px] text-neutral-400">{e.when}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── أسواق المحافظة — كلّ محافظةٍ أسواقها الخاصّة (لا مجرّد صورةٍ مختلفة) ── */
export function SoukTiles({
  governorate,
  souks: souksOverride,
  title,
}: {
  governorate?: string;
  souks?: { label: string; q: string; img?: string; emoji?: string; color?: string; status?: "active" | "hidden" }[];
  title?: string;
}) {
  const souks = souksOverride && souksOverride.length ? souksOverride : govIdentity(governorate).souks;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-800">
          <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
          <span aria-hidden>🕌</span>
          {title ?? `أسواق ${governorate ?? "العراق"}`}
        </h2>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {souks.map((s) => (
          <Link
            key={s.label}
            href={`/search?q=${encodeURIComponent(s.q)}`}
            className="group relative h-44 w-40 flex-shrink-0 overflow-hidden rounded-2xl shadow-sm ring-1 ring-brand-800/20"
          >
            {s.img ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.img}
                  alt={s.label}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-900/85 via-brand-900/20 to-transparent" />
              </>
            ) : (
              <div
                className={`flex h-full w-full items-center justify-center ${s.color ? "" : "bg-gradient-to-br from-brand-700 to-brand-900"}`}
                style={s.color ? { backgroundImage: `linear-gradient(to bottom right, ${s.color}, #16223b)` } : undefined}
              >
                <span className="text-4xl opacity-90 drop-shadow" aria-hidden>
                  {s.emoji}
                </span>
                <span
                  className="pointer-events-none absolute inset-0 opacity-20"
                  style={{
                    backgroundImage:
                      "radial-gradient(40px 40px at 30% 25%, rgba(255,196,96,.7), transparent 70%)",
                  }}
                />
              </div>
            )}
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 p-2.5 text-sm font-bold text-white drop-shadow">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-gold-300" aria-hidden />
              <span className="line-clamp-1">{s.label}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
