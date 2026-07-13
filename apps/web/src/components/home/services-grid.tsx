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

type ServiceStatus = "active" | "beta" | "soon" | "hidden";
type ServiceCfg = { key: string; visible?: boolean; soon?: boolean; status?: ServiceStatus };

// يستنبط الحالة الرباعيّة من status أو من رايتَي visible/soon القديمتَين.
function statusOf(c: ServiceCfg): ServiceStatus {
  if (c.status) return c.status;
  if (c.visible === false) return "hidden";
  if (c.soon) return "soon";
  return "active";
}

const DEFAULT_CFG: ServiceCfg[] = [
  { key: "stores", status: "active" },
  { key: "offers", status: "active" },
  { key: "mutanabbi", status: "active" },
  { key: "restaurants", status: "soon" },
  { key: "veg", status: "soon" },
  { key: "butchers", status: "soon" },
  { key: "pharmacy", status: "soon" },
  { key: "cafes", status: "soon" },
  { key: "oud", status: "soon" },
  { key: "delivery", status: "soon" },
  { key: "realestate", status: "soon" },
  { key: "cars", status: "soon" },
];

// شارةُ الحالة ونمطها: مُفعّل (بلا شارة) / تجريبيّ / قريباً / مخفيّ (لا يظهر).
const BADGE: Record<Exclude<ServiceStatus, "active" | "hidden">, { text: string; cls: string }> = {
  beta: { text: "تجريبي", cls: "bg-petrol text-white" },
  soon: { text: "قريباً", cls: "bg-gold-500 text-brand-900" },
};

export function ServicesGrid({ config, labels }: { config?: ServiceCfg[]; labels?: Record<string, string> }) {
  const items = (config?.length ? config : DEFAULT_CFG)
    .map((c) => ({ c, status: statusOf(c) }))
    .filter(({ c, status }) => status !== "hidden" && REGISTRY[c.key]);
  return (
    <section>
      <div className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-6">
        {items.map(({ c, status }) => {
          const def = REGISTRY[c.key]!;
          const label = labels?.[c.key] ?? def.label;
          const Icon = def.icon;
          const live = status === "active" || status === "beta"; // قابل للنقر
          const badge = status === "beta" ? BADGE.beta : status === "soon" ? BADGE.soon : null;
          const inner = (
            <>
              <span
                className={`relative grid h-16 w-16 place-items-center rounded-2xl shadow-sm transition ${
                  live
                    ? "bg-gradient-to-br from-brand-600 to-brand-800 text-gold-300 ring-1 ring-brand-800 group-hover:from-brand-500 group-hover:to-brand-700"
                    : "bg-sand-100 text-neutral-400 ring-1 ring-sand-200"
                }`}
              >
                <Icon className="h-7 w-7" />
                {badge && (
                  <span className={`absolute -top-1.5 -start-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold ${badge.cls}`}>
                    {badge.text}
                  </span>
                )}
              </span>
              <span className={`line-clamp-1 text-center text-[11px] font-semibold ${live ? "text-brand-800" : "text-neutral-400"}`}>
                {label}
              </span>
            </>
          );
          return def.href && live ? (
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
