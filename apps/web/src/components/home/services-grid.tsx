import Link from "next/link";
import {
  Store,
  Percent,
  UtensilsCrossed,
  Carrot,
  Beef,
  Pill,
  Truck,
  Building2,
  Car,
  Wrench,
  BookOpen,
  Coffee,
} from "lucide-react";

type Service = { label: string; icon: typeof Store; href?: string; soon?: boolean };

// خدمات السوگ — «مدنٌ صغيرة» داخل المحافظة. الحيّة تربط بمساراتٍ حقيقية،
// والقادمة تُعرض بشارة «قريباً» (لا روابط ميّتة) حتى تُبنى طبقتها لاحقاً.
const SERVICES: Service[] = [
  { label: "سوگ المتاجر", icon: Store, href: "/stores" },
  { label: "العروض", icon: Percent, href: "/search" },
  { label: "المكتبات", icon: BookOpen, href: "/search?q=كتب" },
  { label: "المطاعم", icon: UtensilsCrossed, soon: true },
  { label: "الخضار", icon: Carrot, soon: true },
  { label: "القصابون", icon: Beef, soon: true },
  { label: "الصيدليات", icon: Pill, soon: true },
  { label: "المقاهي", icon: Coffee, soon: true },
  { label: "التوصيل", icon: Truck, soon: true },
  { label: "العقارات", icon: Building2, soon: true },
  { label: "السيارات", icon: Car, soon: true },
  { label: "الخدمات", icon: Wrench, soon: true },
];

export function ServicesGrid() {
  return (
    <section>
      <div className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-6">
        {SERVICES.map((s) => {
          const Icon = s.icon;
          const inner = (
            <>
              <span
                className={`relative grid h-16 w-16 place-items-center rounded-2xl shadow-sm transition ${
                  s.soon
                    ? "bg-sand-100 text-neutral-400 ring-1 ring-sand-200"
                    : "bg-gradient-to-br from-brand-600 to-brand-800 text-gold-300 ring-1 ring-brand-800 group-hover:from-brand-500 group-hover:to-brand-700"
                }`}
              >
                <Icon className="h-7 w-7" strokeWidth={1.75} />
                {s.soon && (
                  <span className="absolute -top-1.5 -start-1.5 rounded-full bg-gold-500 px-1.5 py-0.5 text-[8px] font-extrabold text-brand-900">
                    قريباً
                  </span>
                )}
              </span>
              <span className={`line-clamp-1 text-center text-[11px] font-semibold ${s.soon ? "text-neutral-400" : "text-brand-800"}`}>
                {s.label}
              </span>
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="group flex flex-col items-center gap-1.5">
              {inner}
            </Link>
          ) : (
            <div key={s.label} className="flex cursor-default flex-col items-center gap-1.5" aria-disabled>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
