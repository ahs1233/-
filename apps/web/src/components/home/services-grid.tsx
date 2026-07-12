import type { ComponentType } from "react";
import Link from "next/link";
import { Truck, Building2, Car } from "lucide-react";
import {
  ShopfrontIcon,
  BannerTagIcon,
  MutanabbiIcon,
  TureenIcon,
  VegCrateIcon,
  ButcherHookIcon,
  ApothecaryIcon,
  DallahIcon,
  OudIcon,
} from "@/src/components/home/iraqi-icons";

type IconCmp = ComponentType<{ className?: string }>;
type Service = { label: string; icon: IconCmp; href?: string; soon?: boolean };

// خدمات السوگ — «مدنٌ صغيرة» داخل المحافظة، بأيقوناتٍ عراقيّة مرسومة يدويّاً.
// الحيّة تربط بمساراتٍ حقيقية، والقادمة بشارة «قريباً» (بلا روابط ميّتة).
const SERVICES: Service[] = [
  { label: "سوگ المتاجر", icon: ShopfrontIcon, href: "/stores" },
  { label: "العروض", icon: BannerTagIcon, href: "/search" },
  { label: "المتنبّي", icon: MutanabbiIcon, href: "/search?q=كتب" },
  { label: "المطاعم", icon: TureenIcon, soon: true },
  { label: "الخضار", icon: VegCrateIcon, soon: true },
  { label: "القصابون", icon: ButcherHookIcon, soon: true },
  { label: "الصيدليات", icon: ApothecaryIcon, soon: true },
  { label: "المقاهي", icon: DallahIcon, soon: true },
  { label: "دهن العود", icon: OudIcon, soon: true },
  { label: "التوصيل", icon: Truck, soon: true },
  { label: "العقارات", icon: Building2, soon: true },
  { label: "السيارات", icon: Car, soon: true },
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
                <Icon className="h-7 w-7" />
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
