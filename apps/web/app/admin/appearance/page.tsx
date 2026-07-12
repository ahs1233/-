"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { Button, Card, CardBody, useToast } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";
import { buildThemeCss, DEFAULT_APPEARANCE, isValidHex, type AppearanceColors } from "@/src/lib/theme";

const SECTION_LABELS: Record<string, string> = {
  services: "شبكة الخدمات",
  souks: "أسواق المحافظة",
  pulse: "نبض السوق",
  banner: "لافتة العروض",
  best_selling: "الأكثر شراءً",
  new: "وصل حديثاً",
  stores: "متاجر موصى بها",
  featured: "جهة موصى بها",
  categories: "تسوّق حسب الفئة",
};

const COLOR_FIELDS: { key: keyof AppearanceColors; label: string; hint: string }[] = [
  { key: "primary", label: "اللون الأساسيّ (النيليّ)", hint: "الشريط السفليّ، العناوين، البطاقات" },
  { key: "accent", label: "لمسة الذهب", hint: "الأزرار، الأسعار، العلامات" },
  { key: "surface", label: "سطح العاجيّ", hint: "خلفية التطبيق" },
];

export default function AdminAppearance() {
  const { success, error } = useToast();
  const current = trpc.admin.getAppearance.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const save = trpc.admin.updateAppearance.useMutation({
    onSuccess: () => {
      utils.admin.getAppearance.invalidate();
      success("تم حفظ المظهر — سيظهر على التطبيق فوراً");
    },
    onError: (e) => error(e.message),
  });

  const [colors, setColors] = useState<AppearanceColors>(DEFAULT_APPEARANCE.colors);
  const [order, setOrder] = useState<string[]>(DEFAULT_APPEARANCE.homeOrder);

  useEffect(() => {
    const v = current.data as { colors?: AppearanceColors; homeOrder?: string[] } | null;
    if (v && typeof v === "object") {
      if (v.colors) setColors({ ...DEFAULT_APPEARANCE.colors, ...v.colors });
      if (Array.isArray(v.homeOrder) && v.homeOrder.length) setOrder(v.homeOrder);
    }
  }, [current.data]);

  const previewCss = useMemo(() => buildThemeCss(colors, ".theme-preview"), [colors]);
  const allValid = COLOR_FIELDS.every((f) => isValidHex(colors[f.key]));

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
    setOrder(next);
  }

  function reset() {
    setColors(DEFAULT_APPEARANCE.colors);
    setOrder(DEFAULT_APPEARANCE.homeOrder);
  }

  return (
    <div className="space-y-5">
      <style dangerouslySetInnerHTML={{ __html: previewCss }} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-brand-800">المظهر</h1>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw className="h-4 w-4" /> الافتراضيّ
        </Button>
      </div>
      <p className="-mt-2 text-sm text-neutral-500">
        تحكّم بألوان التطبيق وترتيب أقسام الصفحة الرئيسية. التغييرات تظهر لكلّ المستخدمين بعد الحفظ.
      </p>

      {/* الألوان */}
      <Card>
        <CardBody className="space-y-4">
          <h2 className="font-bold text-brand-800">الألوان</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {COLOR_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-sm font-medium text-neutral-700">{f.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={isValidHex(colors[f.key]) ? colors[f.key] : "#000000"}
                    onChange={(e) => setColors((c) => ({ ...c, [f.key]: e.target.value }))}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-neutral-200 bg-white p-1"
                    aria-label={f.label}
                  />
                  <input
                    value={colors[f.key]}
                    onChange={(e) => setColors((c) => ({ ...c, [f.key]: e.target.value }))}
                    className={`h-10 flex-1 rounded-lg border px-3 text-sm nums ${isValidHex(colors[f.key]) ? "border-neutral-300" : "border-danger"}`}
                    dir="ltr"
                  />
                </div>
                <p className="mt-1 text-xs text-neutral-400">{f.hint}</p>
              </div>
            ))}
          </div>

          {/* معاينة حيّة مُنطاقة */}
          <div className="theme-preview rounded-2xl border border-sand-200 bg-sand-50 p-4">
            <p className="mb-3 text-xs font-semibold text-neutral-500">معاينة حيّة</p>
            <div className="rounded-xl bg-brand-700 p-4 text-white">
              <div className="flex items-center gap-2">
                <span className="inline-block h-4 w-1 rounded-full bg-gold-500" />
                <span className="font-extrabold">سوگ بغداد</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-lg bg-gold-500 px-3 py-1.5 text-sm font-bold text-brand-900">ادخل السوق</span>
                <span className="rounded-lg border border-white/30 px-3 py-1.5 text-sm">تصفّح</span>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <span className="rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm font-extrabold text-brand-700 nums">45,000 د.ع</span>
              <span className="rounded-full bg-gold-100 px-3 py-2 text-xs font-bold text-gold-700">★ 4.8</span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ترتيب أقسام الرئيسية */}
      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-bold text-brand-800">ترتيب أقسام الرئيسية</h2>
          <p className="text-xs text-neutral-400">البطل (بوّابة المحافظة) يبقى أوّلاً دائماً.</p>
          <ul className="space-y-2">
            {order.map((k, i) => (
              <li key={k} className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 nums">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-medium text-neutral-800">{SECTION_LABELS[k] ?? k}</span>
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="لأعلى"
                  className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label="لأسفل"
                  className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <div className="sticky bottom-0 -mx-4 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur">
        <Button
          className="w-full"
          size="lg"
          loading={save.isPending}
          disabled={!allValid}
          onClick={() => save.mutate({ colors, homeOrder: order })}
        >
          {allValid ? "حفظ المظهر" : "أدخِل ألواناً صحيحة"}
        </Button>
      </div>
    </div>
  );
}
