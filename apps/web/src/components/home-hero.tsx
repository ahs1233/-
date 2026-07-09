import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Truck, BadgeCheck, ChevronLeft } from "lucide-react";

/**
 * البطل السينمائيّ — بوّابة الشعور «أشعر أنني دخلتُ بغداد».
 * يطبّق قوانين الكانون: سماءٌ ≤ ٢٥٪ وممرٌّ يقود العين (في الصورة نفسها)،
 * فوانيسُ لا تضيء بالتساوي (وهجٌ يهتزّ)، مكانٌ يتنفّس (كِن-بيرنز بطيء)،
 * ذهبٌ معدنيّ لا مسطّح (زرّ نحاسيّ)، ونبضٌ حيّ يوحي أنّ السوق يعمل الآن.
 * الصورة أصلٌ فنّيّ مؤقّت للإطلاق (يمكن استبداله بصورةٍ حصريّة لاحقاً).
 */
export function HomeHero({ governorate }: { governorate?: string }) {
  return (
    <section className="relative overflow-hidden rounded-3xl shadow-xl ring-1 ring-gold-500/30">
      {/* الكادر الحقيقيّ */}
      <div className="relative h-[430px] w-full sm:h-[470px]">
        <Image
          src="/hero-souk.jpg"
          alt="سوق بغداد عند المغرب — أزقّةٌ وفوانيسُ وقباب"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 768px"
          className="animate-drift object-cover object-center"
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
        <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-7">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-300 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-300" />
            </span>
            <span className="text-xs font-semibold tracking-wide text-gold-100 drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
              السوق يعمل الآن — الدفع عند الاستلام
            </span>
          </div>

          <h1
            className="mt-3 text-3xl font-extrabold leading-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:text-4xl"
          >
            {governorate ? `سوق ${governorate}` : "سوق العراق"}
            <span className="block text-gold-200">بين يديك</span>
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85 drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">
            أزقّةٌ من التجّار الموثوقين، بضاعةٌ تمدّ يدها إليك، وتوصيلٌ يصل حتى بابك.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
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

          <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
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
