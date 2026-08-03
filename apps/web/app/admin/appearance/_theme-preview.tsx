"use client";

import { useMemo, useState } from "react";
import { Home, Store, Package, User, Search, ShoppingCart, Star, BadgeCheck } from "lucide-react";
import { buildThemeCss, type AppearanceColors } from "@/src/lib/theme";

type Screen = "home" | "market" | "store" | "product" | "account";
const SCREENS: { id: Screen; label: string; emoji: string }[] = [
  { id: "home", label: "الرئيسية", emoji: "📱" },
  { id: "market", label: "السوق", emoji: "🛍️" },
  { id: "store", label: "المتجر", emoji: "🏪" },
  { id: "product", label: "المنتج", emoji: "📦" },
  { id: "account", label: "الحساب", emoji: "👤" },
];

/** معاينةٌ حيّة بحجم هاتفٍ حقيقيّ مع مبدّل شاشات — يرى المدير أثر الثيم على كلّ الصفحات. */
export function ThemePreview({ colors }: { colors: AppearanceColors }) {
  const [screen, setScreen] = useState<Screen>("home");
  const css = useMemo(() => buildThemeCss(colors, ".tp-scope"), [colors]);

  return (
    <div className="space-y-3">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="flex flex-wrap gap-1.5">
        {SCREENS.map((s) => (
          <button
            key={s.id}
            onClick={() => setScreen(s.id)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              screen === s.id ? "bg-brand-700 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            <span aria-hidden>{s.emoji}</span> {s.label}
          </button>
        ))}
      </div>

      {/* إطار الهاتف */}
      <div className="mx-auto w-full max-w-[320px]">
        <div className="tp-scope overflow-hidden rounded-[2rem] border-[6px] border-neutral-800 bg-sand-50 shadow-xl">
          <div className="relative h-[560px] overflow-hidden">
            <div className="h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {screen === "home" && <HomeMock />}
              {screen === "market" && <MarketMock />}
              {screen === "store" && <StoreMock />}
              {screen === "product" && <ProductMock />}
              {screen === "account" && <AccountMock />}
            </div>
            <TabBar screen={screen} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-sand-200 bg-white/90 px-3 py-2 backdrop-blur">
      <span className="text-lg font-extrabold text-brand-700">
        سو<span className="text-gold-500">گ</span>
      </span>
      <span className="flex flex-1 items-center gap-1 rounded-lg bg-neutral-100 px-2 py-1.5 text-[10px] text-neutral-400">
        <Search className="h-3 w-3" /> ابحث…
      </span>
      <ShoppingCart className="h-4 w-4 text-neutral-500" />
    </div>
  );
}

function TabBar({ screen }: { screen: Screen }) {
  const items: { id: Screen; icon: typeof Home; label: string }[] = [
    { id: "account", icon: User, label: "حسابي" },
    { id: "product", icon: Package, label: "طلباتي" },
    { id: "market", icon: ShoppingCart, label: "السلة" },
    { id: "store", icon: Store, label: "المتاجر" },
    { id: "home", icon: Home, label: "الرئيسية" },
  ];
  return (
    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-brand-700 px-2 py-1.5 text-white">
      {items.map((it) => {
        const Icon = it.icon;
        const active = it.id === screen;
        return (
          <span key={it.id} className={`flex flex-col items-center gap-0.5 px-1.5 text-[9px] ${active ? "text-gold-400" : "text-white/70"}`}>
            <Icon className="h-4 w-4" /> {it.label}
          </span>
        );
      })}
    </div>
  );
}

function HomeMock() {
  return (
    <div className="pb-14">
      <TopBar />
      <div className="space-y-3 p-3">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-3 text-white">
          <span className="text-[9px] text-gold-100">● السوق يعمل الآن</span>
          <p className="mt-0.5 text-lg font-extrabold">سو<span className="text-gold-300">گ</span> بغداد</p>
          <span className="mt-2 inline-block rounded-lg bg-gold-500 px-3 py-1 text-[10px] font-extrabold text-brand-900">ادخل السوق</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {["🛍️", "🏷️", "📚", "🍲"].map((e, i) => (
            <span key={i} className="grid aspect-square place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-base text-gold-300">{e}</span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-sand-200 bg-white">
              <div className="relative aspect-square bg-sand-100">
                <span className="absolute start-1 top-1 rounded-full bg-brand-900/75 px-1.5 py-0.5 text-[8px] font-bold text-gold-100">📍 بغداد</span>
              </div>
              <div className="p-1.5">
                <p className="text-[10px] font-semibold text-neutral-800">دلّة نحاسية</p>
                <p className="text-[11px] font-extrabold text-brand-700 nums">45,000 د.ع</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MarketMock() {
  return (
    <div className="pb-14">
      <TopBar />
      <div className="p-3">
        <p className="mb-2 text-xs font-bold text-brand-800">نتائج «نحاس»</p>
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-sand-200 bg-white">
              <div className="aspect-square bg-sand-100" />
              <div className="p-1.5">
                <p className="text-[10px] font-semibold text-neutral-800">منتج {i + 1}</p>
                <p className="text-[11px] font-extrabold text-brand-700 nums">{(i + 2) * 10},000 د.ع</p>
                <span className="mt-1 inline-block rounded bg-petrol/10 px-1 text-[8px] font-bold text-petrol">دفع عند الاستلام</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StoreMock() {
  return (
    <div className="pb-14">
      <div className="h-20 bg-gradient-to-br from-brand-600 to-brand-800" />
      <div className="-mt-8 px-3">
        <div className="rounded-2xl border border-sand-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-sand-100 text-xl">🏪</span>
            <div>
              <p className="flex items-center gap-1 text-sm font-extrabold text-neutral-900">بيت النحاس <BadgeCheck className="h-3.5 w-3.5 text-petrol" /></p>
              <p className="flex items-center gap-1 text-[10px] font-bold text-gold-600"><Star className="h-3 w-3 fill-gold-400 text-gold-400" /> 4.8 · بغداد</p>
            </div>
          </div>
          <button className="mt-2 w-full rounded-xl bg-gold-500 py-1.5 text-[11px] font-extrabold text-brand-900">دخول المتجر</button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-sand-200 bg-white">
              <div className="aspect-square bg-sand-100" />
              <div className="p-1.5"><p className="text-[11px] font-extrabold text-brand-700 nums">30,000 د.ع</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductMock() {
  return (
    <div className="pb-14">
      <div className="aspect-[4/3] bg-sand-100" />
      <div className="space-y-2 p-3">
        <p className="text-sm font-extrabold text-neutral-900">دلّة نحاسية بغداديّة</p>
        <p className="text-xl font-extrabold text-brand-700 nums">45,000 د.ع</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-petrol/10 px-2 py-0.5 text-[10px] font-bold text-petrol"><BadgeCheck className="h-3 w-3" /> تاجر موثوق</span>
        <button className="btn-brass w-full rounded-xl py-2 text-xs font-extrabold text-[#16223b]">أضف إلى السلة</button>
      </div>
    </div>
  );
}

function AccountMock() {
  return (
    <div className="pb-14">
      <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-4 text-white">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15 text-lg">👤</span>
        <p className="mt-2 text-sm font-extrabold">أهلاً، أبو محمد</p>
      </div>
      <div className="space-y-2 p-3">
        {["طلباتي", "المفضلة", "العناوين", "الإشعارات"].map((t) => (
          <div key={t} className="flex items-center justify-between rounded-xl border border-sand-200 bg-white px-3 py-2.5 text-xs font-semibold text-neutral-700">
            {t} <span className="text-gold-500">‹</span>
          </div>
        ))}
      </div>
    </div>
  );
}
