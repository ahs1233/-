"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUp, ArrowDown, RotateCcw, Eye, EyeOff, Check, AlertTriangle, Palette, LayoutList, Grid3x3 } from "lucide-react";
import { Button, Card, CardBody, useToast } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";
import {
  buildThemeCss,
  contrastRatio,
  isValidHex,
  PRESETS,
  SECTION_LABELS,
  SERVICE_LABELS,
  DEFAULT_APPEARANCE,
  type AppearanceColors,
  type SectionCfg,
  type ServiceCfg,
} from "@/src/lib/theme";

const COLOR_FIELDS: { key: keyof AppearanceColors; label: string; hint: string }[] = [
  { key: "primary", label: "الأساسيّ (نيليّ)", hint: "الشريط، العناوين، البطاقات" },
  { key: "accent", label: "لمسة الذهب", hint: "الأزرار، الأسعار، العلامات" },
  { key: "surface", label: "سطح العاجيّ", hint: "خلفية التطبيق" },
  { key: "live", label: "الأخضر الحيّ", hint: "النبض، «موثوق»، التوصيل" },
];

type Tab = "colors" | "sections" | "services";
const TABS: { id: Tab; label: string; icon: typeof Palette }[] = [
  { id: "colors", label: "الألوان", icon: Palette },
  { id: "sections", label: "الأقسام", icon: LayoutList },
  { id: "services", label: "الخدمات", icon: Grid3x3 },
];

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  const tmp = next[i]!;
  next[i] = next[j]!;
  next[j] = tmp;
  return next;
}

export default function AdminAppearance() {
  const { success, error } = useToast();
  const current = trpc.admin.getAppearance.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const save = trpc.admin.updateAppearance.useMutation({
    onSuccess: () => {
      utils.admin.getAppearance.invalidate();
      setBaseline(JSON.stringify({ colors, sections, services }));
      success("تم حفظ المظهر — يظهر على التطبيق فوراً");
    },
    onError: (e) => error(e.message),
  });

  const [tab, setTab] = useState<Tab>("colors");
  const [colors, setColors] = useState<AppearanceColors>(DEFAULT_APPEARANCE.colors);
  const [sections, setSections] = useState<SectionCfg[]>(DEFAULT_APPEARANCE.sections);
  const [services, setServices] = useState<ServiceCfg[]>(DEFAULT_APPEARANCE.services);
  const [baseline, setBaseline] = useState<string>("");

  useEffect(() => {
    const v = current.data as { colors?: AppearanceColors; sections?: SectionCfg[]; services?: ServiceCfg[] } | null;
    const c = v?.colors ? { ...DEFAULT_APPEARANCE.colors, ...v.colors } : DEFAULT_APPEARANCE.colors;
    const s = v?.sections?.length ? v.sections : DEFAULT_APPEARANCE.sections;
    const sv = v?.services?.length ? v.services : DEFAULT_APPEARANCE.services;
    setColors(c);
    setSections(s);
    setServices(sv);
    setBaseline(JSON.stringify({ colors: c, sections: s, services: sv }));
  }, [current.data]);

  const previewCss = useMemo(() => buildThemeCss(colors, ".theme-preview"), [colors]);
  const allValid = COLOR_FIELDS.every((f) => isValidHex(colors[f.key]));
  const dirty = baseline !== "" && baseline !== JSON.stringify({ colors, sections, services });

  const checks = useMemo(
    () => [
      { label: "نصٌّ أبيض على النيليّ", ratio: contrastRatio(colors.primary, "#ffffff"), min: 4.5 },
      { label: "نصّ الزرّ على الذهبيّ", ratio: contrastRatio(colors.accent, "#16223b"), min: 3 },
      { label: "نصٌّ داكن على العاجيّ", ratio: contrastRatio(colors.surface, "#1a1813"), min: 4.5 },
    ],
    [colors],
  );

  function applyPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (p) setColors(p.colors);
  }
  function resetAll() {
    setColors(DEFAULT_APPEARANCE.colors);
    setSections(DEFAULT_APPEARANCE.sections);
    setServices(DEFAULT_APPEARANCE.services);
  }
  function discard() {
    const b = JSON.parse(baseline) as { colors: AppearanceColors; sections: SectionCfg[]; services: ServiceCfg[] };
    setColors(b.colors);
    setSections(b.sections);
    setServices(b.services);
  }

  return (
    <div className="space-y-5 pb-24">
      <style dangerouslySetInnerHTML={{ __html: previewCss }} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-brand-800">المظهر</h1>
          <p className="text-sm text-neutral-500">تحكّم بألوان التطبيق وأقسام الرئيسية والخدمات — لكلّ المستخدمين.</p>
        </div>
        <Button variant="outline" size="sm" onClick={resetAll}>
          <RotateCcw className="h-4 w-4" /> الافتراضيّ
        </Button>
      </div>

      {/* تبويبات */}
      <div className="flex gap-1 rounded-xl border border-neutral-200 bg-neutral-50 p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                tab === t.id ? "bg-brand-700 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "colors" && (
        <div className="space-y-5">
          {/* قوالب جاهزة */}
          <Card>
            <CardBody className="space-y-3">
              <h2 className="font-bold text-brand-800">قوالب جاهزة</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p.id)}
                    className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-2 text-start transition hover:border-gold-300"
                  >
                    <span className="flex -space-x-1">
                      {[p.colors.primary, p.colors.accent, p.colors.surface, p.colors.live].map((c, i) => (
                        <span key={i} className="h-6 w-6 rounded-full ring-2 ring-white" style={{ backgroundColor: c }} />
                      ))}
                    </span>
                    <span className="text-xs font-semibold text-neutral-700">{p.name}</span>
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* الألوان */}
          <Card>
            <CardBody className="space-y-4">
              <h2 className="font-bold text-brand-800">الألوان</h2>
              <div className="grid gap-4 sm:grid-cols-2">
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
                        dir="ltr"
                        className={`h-10 flex-1 rounded-lg border px-3 text-sm nums ${isValidHex(colors[f.key]) ? "border-neutral-300" : "border-danger"}`}
                      />
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">{f.hint}</p>
                  </div>
                ))}
              </div>

              {/* فحص التباين (الوصول) */}
              <div className="space-y-1.5 rounded-xl bg-neutral-50 p-3">
                <p className="text-xs font-semibold text-neutral-600">فحص التباين (سهولة القراءة)</p>
                {checks.map((c) => {
                  const ok = c.ratio >= c.min;
                  return (
                    <div key={c.label} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-neutral-600">
                        {ok ? <Check className="h-3.5 w-3.5 text-petrol" /> : <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                        {c.label}
                      </span>
                      <span className={`nums font-semibold ${ok ? "text-petrol" : "text-warning"}`}>{c.ratio.toFixed(1)}:1</span>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {/* معاينة حيّة غنيّة */}
          <Card>
            <CardBody>
              <h2 className="mb-3 font-bold text-brand-800">معاينة حيّة</h2>
              <div className="theme-preview overflow-hidden rounded-2xl border border-sand-200 bg-sand-50 p-4">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-4 text-white">
                  <div className="flex items-center gap-2 text-xs text-gold-100">
                    <span className="h-2 w-2 rounded-full bg-gold-300" /> السوق يعمل الآن
                  </div>
                  <p className="mt-1 text-2xl font-extrabold">
                    سو<span className="text-gold-300">گ</span> بغداد
                  </p>
                  <div className="mt-3 flex gap-2">
                    <span className="rounded-xl bg-gold-500 px-4 py-2 text-sm font-extrabold text-brand-900">ادخل السوق</span>
                    <span className="rounded-xl border border-white/30 px-4 py-2 text-sm">تصفّح</span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="overflow-hidden rounded-2xl border border-sand-200 bg-white">
                    <div className="relative aspect-square bg-sand-100">
                      <span className="absolute start-2 top-2 rounded-full bg-brand-900/75 px-2 py-0.5 text-[10px] font-bold text-gold-100">📍 بغداد</span>
                      <span className="absolute end-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-gold-600">★ 4.8</span>
                    </div>
                    <div className="p-2">
                      <p className="text-sm font-semibold text-neutral-900">دلّة نحاسية</p>
                      <p className="text-base font-extrabold text-brand-700 nums">45,000 د.ع</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-xl border border-sand-200 bg-white p-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-petrol/10 text-petrol">✓</span>
                      <span className="text-xs font-semibold text-neutral-700">افتتح متجرٌ أبوابه</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-gold-300">﷼</span>
                      <span className="rounded-full bg-gold-100 px-3 py-1.5 text-xs font-bold text-gold-700">عرض اليوم</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "sections" && (
        <Card>
          <CardBody className="space-y-3">
            <h2 className="font-bold text-brand-800">أقسام الرئيسية</h2>
            <p className="text-xs text-neutral-400">رتّب الأقسام وأظهِرها أو أخفِها. البطل (بوّابة المحافظة) يبقى أوّلاً دائماً.</p>
            <ul className="space-y-2">
              {sections.map((s, i) => (
                <li
                  key={s.key}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${s.visible ? "border-neutral-200 bg-white" : "border-dashed border-neutral-200 bg-neutral-50"}`}
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 nums">{i + 1}</span>
                  <span className={`flex-1 text-sm font-medium ${s.visible ? "text-neutral-800" : "text-neutral-400"}`}>
                    {SECTION_LABELS[s.key] ?? s.key}
                  </span>
                  <button
                    onClick={() => setSections((a) => a.map((x, k) => (k === i ? { ...x, visible: !x.visible } : x)))}
                    aria-label={s.visible ? "إخفاء" : "إظهار"}
                    className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                  >
                    {s.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button onClick={() => setSections((a) => move(a, i, -1))} disabled={i === 0} aria-label="لأعلى" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 disabled:opacity-30">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => setSections((a) => move(a, i, 1))} disabled={i === sections.length - 1} aria-label="لأسفل" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 disabled:opacity-30">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {tab === "services" && (
        <Card>
          <CardBody className="space-y-3">
            <h2 className="font-bold text-brand-800">خدمات السوگ</h2>
            <p className="text-xs text-neutral-400">رتّب الخدمات، أظهِرها/أخفِها، وحدّد أيّها «قريباً» (غير مُفعّل بعد).</p>
            <ul className="space-y-2">
              {services.map((s, i) => (
                <li
                  key={s.key}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${s.visible ? "border-neutral-200 bg-white" : "border-dashed border-neutral-200 bg-neutral-50"}`}
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 nums">{i + 1}</span>
                  <span className={`flex-1 text-sm font-medium ${s.visible ? "text-neutral-800" : "text-neutral-400"}`}>
                    {SERVICE_LABELS[s.key] ?? s.key}
                  </span>
                  <button
                    onClick={() => setServices((a) => a.map((x, k) => (k === i ? { ...x, soon: !x.soon } : x)))}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${s.soon ? "bg-gold-100 text-gold-700" : "bg-petrol/10 text-petrol"}`}
                  >
                    {s.soon ? "قريباً" : "مُفعّل"}
                  </button>
                  <button
                    onClick={() => setServices((a) => a.map((x, k) => (k === i ? { ...x, visible: !x.visible } : x)))}
                    aria-label={s.visible ? "إخفاء" : "إظهار"}
                    className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                  >
                    {s.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button onClick={() => setServices((a) => move(a, i, -1))} disabled={i === 0} aria-label="لأعلى" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 disabled:opacity-30">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => setServices((a) => move(a, i, 1))} disabled={i === services.length - 1} aria-label="لأسفل" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 disabled:opacity-30">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* شريط الحفظ الثابت */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur md:mr-56">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-2">
          <span className={`flex-1 text-xs font-medium ${dirty ? "text-warning" : "text-neutral-400"}`}>
            {dirty ? "● تغييرات غير محفوظة" : "كل التغييرات محفوظة"}
          </span>
          {dirty && (
            <Button variant="outline" size="sm" onClick={discard}>
              تراجع
            </Button>
          )}
          <Button
            size="lg"
            loading={save.isPending}
            disabled={!allValid || !dirty}
            onClick={() => save.mutate({ colors, sections, services })}
          >
            {allValid ? "حفظ المظهر" : "أدخِل ألواناً صحيحة"}
          </Button>
        </div>
      </div>
    </div>
  );
}
