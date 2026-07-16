import Image from "next/image";
import { Sun, Store, Tag, DoorOpen, PackageCheck } from "lucide-react";
import { govIdentity } from "@/src/lib/governorate-identity";
import type { CityStats } from "@al-souq/api";

// متوسّطات حرارة بغداد الشهريّة (تقريبيّة) — ريثما يُوصَل مزوّد طقسٍ حقيقيّ.
const BAGHDAD_TEMPS = [16, 19, 24, 30, 37, 42, 44, 44, 40, 33, 24, 17];

function baghdadNow() {
  const now = new Date();
  const b = new Date(now.getTime() + (now.getTimezoneOffset() + 180) * 60000); // UTC+3
  const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const months = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيّار", "حزيران", "تمّوز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];
  const h = b.getHours();
  const greeting = h < 12 ? "صباح الخير" : h < 17 ? "طابت أوقاتك" : "مساء الخير";
  return {
    greeting,
    day: days[b.getDay()]!,
    date: `${b.getDate()} ${months[b.getMonth()]!}`,
    temp: BAGHDAD_TEMPS[b.getMonth()] ?? 30,
  };
}

/**
 * بطلُ الرئيسية — المدينة هي الشخصيّة الرئيسيّة، لا قائمةَ أقسام. تحيّةٌ باسم المستخدم،
 * ثمّ «اليوم في {المحافظة}» بأرقامٍ حيّة (سوق نشط · عرض · متجر افتتح · منتج وصل).
 */
export function CityHero({
  governorate,
  userName,
  heroImage,
  feel,
  stats,
  activeMarkets,
}: {
  governorate?: string;
  userName?: string | null;
  heroImage?: string;
  feel?: string;
  stats: CityStats;
  activeMarkets: number;
}) {
  const base = govIdentity(governorate);
  const hero = heroImage ?? base.hero;
  const gov = governorate ?? "العراق";
  const t = baghdadNow();

  const cells = [
    { icon: Store, n: activeMarkets, label: "سوق نشط" },
    { icon: Tag, n: stats.offers, label: "عرض جديد" },
    { icon: DoorOpen, n: stats.newStores, label: "متجر افتتح" },
    { icon: PackageCheck, n: stats.newProducts, label: "منتج وصل" },
  ];

  return (
    <section className="overflow-hidden rounded-3xl border border-line ring-1 ring-gold-500/20">
      {/* صورة المدينة + التحيّة */}
      <div className="relative aspect-[16/9] max-h-[240px] w-full">
        <Image src={hero} alt={`${gov} — ${feel ?? base.feel}`} fill priority sizes="(max-width:768px) 100vw, 768px" className="object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070d] via-[#05070d]/60 to-[#05070d]/10" />
        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-petrol/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-petrol" />
            </span>
            <span className="text-sm font-semibold text-white/90 drop-shadow">
              {t.greeting}{userName ? `، ${userName}` : ""}
            </span>
            <span className="ms-auto inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
              <Sun className="h-3.5 w-3.5 text-gold-300" />
              <span className="nums font-bold">{t.temp}°</span>
              <span className="text-white/50">·</span>
              <span className="text-white/80">{t.day}</span>
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-gold-100/80 drop-shadow">اليوم في</p>
          <h1 className="text-3xl font-extrabold leading-none text-gold-400 drop-shadow sm:text-4xl">{gov}</h1>
        </div>
      </div>

      {/* شريط الأرقام الحيّة — نبض المدينة رقماً */}
      <div className="grid grid-cols-4 divide-x divide-x-reverse divide-line bg-card">
        {cells.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="flex flex-col items-center gap-1 px-1 py-3 text-center">
              <Icon className="h-4 w-4 text-gold-400" />
              <span className="nums text-xl font-extrabold leading-none text-neutral-100">{c.n}</span>
              <span className="text-[10px] font-medium text-neutral-400">{c.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
