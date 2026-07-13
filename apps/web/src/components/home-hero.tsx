import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Truck, BadgeCheck, ChevronLeft } from "lucide-react";
import { govIdentity } from "@/src/lib/governorate-identity";
import type { HomeStats } from "@al-souq/api";

/**
 * بوّابة المحافظة — «أشعر أنني دخلتُ محافظةً عراقيّة حيّة تتنفّس».
 * التخطيط ثابت، لكن الإحساس يتغيّر بالمحافظة (الشعور والأسواق، لا الصورة فقط).
 * البطل «يتنفّس»: طبقةٌ حيّة فوق الصورة (مفتوح الآن · جهة اليوم · عروض اليوم).
 * يطبّق الكانون: فوانيسُ تهتزّ، كِن-بيرنز، ذهبٌ معدنيّ.
 * الصورة لبغداد الآن؛ تُضاف أصولٌ حصريّة لكلّ محافظة لاحقاً.
 */

// صياغة عربية للعدد التقريبيّ (٣٤٢ → «٣٠٠+»، ١٢٤٠٠ → «١٢ ألف+»).
function approxStores(n: number): string {
  if (n >= 1000) return `${Math.floor(n / 1000)} ألف+`;
  if (n >= 100) return `${Math.floor(n / 100) * 100}+`;
  return `${n}`;
}

// الوقت يغيّر البطل — بغداد صباحاً غير بغداد ليلاً (بتوقيت بغداد UTC+3).
function timeMood(): { filter: string; eyebrow: string } {
  const now = new Date();
  const h = (now.getUTCHours() + 3) % 24;
  const friday = (now.getUTCDay() + (now.getUTCHours() + 3 >= 24 ? 1 : 0)) % 7 === 5;
  if (friday && h >= 7 && h < 16) return { filter: "brightness(1.05) saturate(1.02) sepia(.06)", eyebrow: "جمعةٌ في السوق — أبوابٌ تُفتح على مهل" };
  if (h >= 5 && h < 11) return { filter: "brightness(1.1) saturate(.88) hue-rotate(-7deg)", eyebrow: "صباح الخير — السوق يفتح أبوابه" };
  if (h >= 11 && h < 16) return { filter: "brightness(1.06) saturate(.94)", eyebrow: "ظهيرةُ السوق — الحركة في ذروتها" };
  if (h >= 16 && h < 19) return { filter: "brightness(.98) saturate(1.12) sepia(.08)", eyebrow: "المغرب — ساعة السوق الذهبيّة" };
  return { filter: "brightness(.62) saturate(.95) sepia(.12)", eyebrow: "أضواء السوق تشتعل ليلاً" };
}

export function HomeHero({
  governorate,
  storeCount,
  stats,
  heroImage,
  feel,
}: {
  governorate?: string;
  storeCount?: number;
  stats?: HomeStats;
  /** صورة البطل (تتجاوز الافتراضيّة) — من تبويب المحافظات. */
  heroImage?: string;
  /** «الشعور» — يُستخدم في النصّ البديل. */
  feel?: string;
}) {
  const base = govIdentity(governorate);
  const id = { ...base, hero: heroImage ?? base.hero, feel: feel ?? base.feel };
  const mood = timeMood();
  return (
    <section className="relative overflow-hidden rounded-3xl shadow-xl ring-1 ring-gold-500/30">
      {/* الكادر الحقيقيّ للمحافظة — لافتةٌ مستطيلة أفقيّة (٣:٢) بحدٍّ أعلى معتدل،
          لا كتلةٌ طوليّة كبيرة. */}
      <div className="relative w-full" style={{ aspectRatio: "3 / 2", maxHeight: 420 }}>
        <Image
          src={id.hero}
          alt={`سوگ ${governorate ?? "العراق"} — ${id.feel}`}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 768px"
          style={{ filter: mood.filter }}
          className="animate-drift object-cover object-center transition-[filter] duration-700"
        />

        {/* وهج الفوانيس — لا تنير بالتساوي */}
        <div
          className="animate-flicker pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(60px 60px at 18% 40%, rgba(255,190,90,0.55), transparent 70%)," +
              "radial-gradient(52px 52px at 82% 44%, rgba(255,190,90,0.5), transparent 70%)," +
              "radial-gradient(120px 90px at 50% 30%, rgba(255,196,96,0.35), transparent 72%)",
            mixBlendMode: "screen",
          }}
        />

        {/* حُجُبٌ دافئة — لقراءة النصّ وعمق الغروب */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#160d04]/95 via-[#160d04]/55 to-[#160d04]/10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/50 to-transparent" />

        {/* المحتوى — محاذاةٌ سفليّة، كما تدخل السوق من الأرض لا من السماء */}
        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-300 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-300" />
            </span>
            <span className="text-xs font-semibold tracking-wide text-gold-100 drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
              {mood.eyebrow}
            </span>
          </div>

          <h1 className="mt-1.5 text-3xl font-extrabold leading-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:text-4xl">
            سو<span className="text-gold-300">گ</span> {governorate ?? "العراق"}
          </h1>
          {storeCount && storeCount > 0 ? (
            <p className="mt-1 text-sm font-bold text-gold-100 drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]">
              أكثر من <span className="nums">{approxStores(storeCount)}</span> متجر محلّي
              {stats && stats.openStores > 0 && <span className="text-gold-200/80"> · {stats.openStores} مفتوح الآن</span>}
            </p>
          ) : (
            <p className="mt-1 max-w-md text-sm leading-relaxed text-white/85 drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">
              أزقّةٌ من التجّار الموثوقين، بضاعةٌ تمدّ يدها إليك.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link
              href="/categories"
              className="btn-brass inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold text-[#16223b] transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              ادخل السوق
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              href="/stores"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
            >
              تصفّح المتاجر
            </Link>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
            <Chip icon={<Truck className="h-3.5 w-3.5" />} text="دفع عند الاستلام" />
            <Chip icon={<ShieldCheck className="h-3.5 w-3.5" />} text="تجّار موثوقون" />
            <Chip icon={<BadgeCheck className="h-3.5 w-3.5" />} text="منتجات عراقية" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Chip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/25 px-3 py-1.5 font-medium text-white/90 backdrop-blur">
      {icon}
      {text}
    </span>
  );
}
