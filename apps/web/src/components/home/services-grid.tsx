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
type ServiceDef = { label: string; icon: IconCmp; href?: string };

// سجلٌّ مفتاحيّ للخدمات — الأدمن يضبط الإظهار والترتيب و«قريباً» من لوحة المظهر،
// والتسميات والأيقونات والروابط تبقى هنا (بأيقوناتٍ عراقيّة مرسومة يدويّاً).
const REGISTRY: Record<string, ServiceDef> = {
  stores: { label: "سوگ المتاجر", icon: ShopfrontIcon, href: "/stores" },
  offers: { label: "العروض", icon: BannerTagIcon, href: "/search" },
  mutanabbi: { label: "المتنبّي", icon: MutanabbiIcon, href: "/search?q=كتب" },
  restaurants: { label: "المطاعم", icon: TureenIcon },
  veg: { label: "الخضار", icon: VegCrateIcon },
  butchers: { label: "القصابون", icon: ButcherHookIcon },
  pharmacy: { label: "الصيدليات", icon: ApothecaryIcon },
  cafes: { label: "المقاهي", icon: DallahIcon },
  oud: { label: "دهن العود", icon: OudIcon },
  delivery: { label: "التوصيل", icon: Truck },
  realestate: { label: "العقارات", icon: Building2 },
  cars: { label: "السيارات", icon: Car },
};

type ServiceCfg = { key: string; visible: boolean; soon: boolean };

const DEFAULT_CFG: ServiceCfg[] = [
  { key: "stores", visible: true, soon: false },
  { key: "offers", visible: true, soon: false },
  { key: "mutanabbi", visible: true, soon: false },
  { key: "restaurants", visible: true, soon: true },
  { key: "veg", visible: true, soon: true },
  { key: "butchers", visible: true, soon: true },
  { key: "pharmacy", visible: true, soon: true },
  { key: "cafes", visible: true, soon: true },
  { key: "oud", visible: true, soon: true },
  { key: "delivery", visible: true, soon: true },
  { key: "realestate", visible: true, soon: true },
  { key: "cars", visible: true, soon: true },
];

export function ServicesGrid({ config, labels }: { config?: ServiceCfg[]; labels?: Record<string, string> }) {
  const items = (config?.length ? config : DEFAULT_CFG).filter((c) => c.visible && REGISTRY[c.key]);
  return (
    <section>
      <div className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-6">
        {items.map((c) => {
          const def = REGISTRY[c.key]!;
          const label = labels?.[c.key] ?? def.label;
          const Icon = def.icon;
          const inner = (
            <>
              <span
                className={`relative grid h-16 w-16 place-items-center rounded-2xl shadow-sm transition ${
                  c.soon
                    ? "bg-sand-100 text-neutral-400 ring-1 ring-sand-200"
                    : "bg-gradient-to-br from-brand-600 to-brand-800 text-gold-300 ring-1 ring-brand-800 group-hover:from-brand-500 group-hover:to-brand-700"
                }`}
              >
                <Icon className="h-7 w-7" />
                {c.soon && (
                  <span className="absolute -top-1.5 -start-1.5 rounded-full bg-gold-500 px-1.5 py-0.5 text-[8px] font-extrabold text-brand-900">
                    قريباً
                  </span>
                )}
              </span>
              <span className={`line-clamp-1 text-center text-[11px] font-semibold ${c.soon ? "text-neutral-400" : "text-brand-800"}`}>
                {label}
              </span>
            </>
          );
          return def.href && !c.soon ? (
            <Link key={c.key} href={def.href} className="group flex flex-col items-center gap-1.5">
              {inner}
            </Link>
          ) : (
            <div key={c.key} className="flex cursor-default flex-col items-center gap-1.5" aria-disabled>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
