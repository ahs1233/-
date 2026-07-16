"use client";

import Link from "next/link";
import { Palette, LayoutList, MapPin, Megaphone, ChevronLeft, LayoutGrid, Tags } from "lucide-react";
import { Card } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";
import { DEFAULT_APPEARANCE, type AppearanceColors, type SectionCfg } from "@/src/lib/theme";

export default function AppearanceHub() {
  const appearance = trpc.admin.getAppearance.useQuery(undefined, { retry: false });
  const govs = trpc.admin.govList.useQuery(undefined, { retry: false });
  const ads = trpc.admin.adList.useQuery(undefined, { retry: false });
  const markets = trpc.admin.marketList.useQuery(undefined, { retry: false });
  const categories = trpc.admin.categories.useQuery(undefined, { retry: false });

  const v = (appearance.data ?? null) as { colors?: AppearanceColors; sections?: SectionCfg[] } | null;
  const colors = v?.colors ?? DEFAULT_APPEARANCE.colors;
  const sections = v?.sections ?? DEFAULT_APPEARANCE.sections;
  const visibleSections = sections.filter((s) => s.visible).length;
  const enabledGovs = govs.data?.filter((g) => g.enabled).length ?? 0;
  const activeAds = ads.data?.filter((a) => a.active).length ?? 0;
  const enabledMarkets = markets.data?.filter((m) => m.enabled).length ?? 0;
  const topCategories = categories.data?.filter((c) => !c.parentId).length ?? 0;

  const cards = [
    {
      href: "/admin/appearance/markets",
      icon: LayoutGrid,
      title: "الأسواق (البوّابات)",
      desc: "بوّابات المحافظة: متاجر بغداد، الإلكتروني، المطاعم… رتّبها وتحكّم بعرض كلٍّ منها",
      accent: <Stat n={enabledMarkets} unit="سوق مفعّل" loading={markets.isLoading} />,
    },
    {
      href: "/admin/categories",
      icon: Tags,
      title: "الأقسام (الفئات)",
      desc: "الفئات التي تظهر داخل كلّ سوق كبوّابات (الأزياء، الإلكترونيات…) — سمِّها، رتّبها، صوّرها، احذفها",
      accent: <Stat n={topCategories} unit="قسم رئيسيّ" loading={categories.isLoading} />,
    },
    {
      href: "/admin/appearance/theme",
      icon: Palette,
      title: "الألوان والهويّة",
      desc: "لون التطبيق، القوالب الجاهزة، والمعاينة الحيّة",
      accent: (
        <span className="flex -space-x-1.5">
          {[colors.primary, colors.accent, colors.surface, colors.live].map((c, i) => (
            <span key={i} className="h-6 w-6 rounded-full ring-2 ring-white" style={{ backgroundColor: c }} />
          ))}
        </span>
      ),
    },
    {
      href: "/admin/appearance/sections",
      icon: LayoutList,
      title: "تخطيط السوق (الافتراضيّ)",
      desc: "ترتيب أقسام صفحة السوق وإظهارها: الأقسام ← الإعلانات ← المتاجر ← المنتجات ← أفضل المتاجر ← النبض. (يمكن تخصيص كلّ سوق من «الأسواق»)",
      accent: <Stat n={visibleSections} unit="قسم ظاهر" />,
    },
    {
      href: "/admin/appearance/governorates",
      icon: MapPin,
      title: "المحافظات",
      desc: "صورة البطل، الشعور، والأسواق لكلّ محافظة",
      accent: <Stat n={enabledGovs} unit="محافظة مفعّلة" loading={govs.isLoading} />,
    },
    {
      href: "/admin/appearance/ads",
      icon: Megaphone,
      title: "الإعلانات",
      desc: "لافتات ترويجيّة مجدولة لكلّ محافظة",
      accent: <Stat n={activeAds} unit="إعلان فعّال" loading={ads.isLoading} />,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-brand-800">المظهر</h1>
        <p className="text-sm text-neutral-500">
          تحكّمٌ كاملٌ بتجربة التطبيق — كلّ بطاقةٍ محرّرٌ مستقلّ. لكلّ المستخدمين.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.href} href={c.href}>
              <Card className="group h-full transition hover:border-gold-300 hover:shadow-md">
                <div className="flex items-start gap-3 p-4">
                  <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-gold-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h2 className="font-bold text-brand-800">{c.title}</h2>
                      <ChevronLeft className="h-4 w-4 text-neutral-300 transition group-hover:text-gold-500" />
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500">{c.desc}</p>
                    <div className="mt-2.5">{c.accent}</div>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ n, unit, loading }: { n: number; unit: string; loading?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-lg bg-neutral-50 px-2.5 py-1">
      <span className="text-lg font-extrabold text-brand-700 nums">{loading ? "…" : n}</span>
      <span className="text-[11px] text-neutral-500">{unit}</span>
    </span>
  );
}
