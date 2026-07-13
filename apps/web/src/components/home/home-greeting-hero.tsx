import Image from "next/image";
import { Sun } from "lucide-react";
import { govIdentity } from "@/src/lib/governorate-identity";

// متوسّطات حرارة بغداد الشهريّة (تقريبيّة) — ريثما يُوصَل مزوّد طقسٍ حقيقيّ.
const BAGHDAD_TEMPS = [16, 19, 24, 30, 37, 42, 44, 44, 40, 33, 24, 17];

function baghdadNow() {
  const now = new Date();
  const b = new Date(now.getTime() + (now.getTimezoneOffset() + 180) * 60000); // UTC+3
  const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const months = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيّار", "حزيران", "تمّوز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];
  return {
    day: days[b.getDay()]!,
    date: `${b.getDate()} ${months[b.getMonth()]!}`,
    temp: BAGHDAD_TEMPS[b.getMonth()] ?? 30,
  };
}

/** بطلُ الرئيسية الداكن — «أهلاً بك في بغداد» + حبّة الطقس والتاريخ. لا أزرار؛ الشبكة أدناه هي الدعوة. */
export function HomeGreetingHero({ governorate, heroImage, feel }: { governorate?: string; heroImage?: string; feel?: string }) {
  const base = govIdentity(governorate);
  const hero = heroImage ?? base.hero;
  const t = baghdadNow();
  return (
    <section className="relative overflow-hidden rounded-3xl ring-1 ring-gold-500/25">
      <div className="relative aspect-[16/11] max-h-[360px] w-full">
        <Image src={hero} alt={`سوگ ${governorate ?? "العراق"} — ${feel ?? base.feel}`} fill priority sizes="(max-width:768px) 100vw, 768px" className="object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070d] via-[#05070d]/55 to-[#05070d]/15" />
        <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-6">
          <span className="text-sm font-semibold text-gold-100/90 drop-shadow">أهلاً بك في</span>
          <h1 className="text-4xl font-extrabold leading-tight text-gold-400 drop-shadow sm:text-5xl">{governorate ?? "العراق"}</h1>
          <p className="mt-1 max-w-xs text-sm text-white/80 drop-shadow">استكشف كل ما تحتاجه في سوق واحد</p>
          <span className="mt-3 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
            <Sun className="h-4 w-4 text-gold-300" />
            <span className="nums font-bold">{t.temp}°</span>
            <span className="text-white/50">·</span>
            <span className="text-white/80">{t.day}، {t.date}</span>
          </span>
        </div>
      </div>
    </section>
  );
}
